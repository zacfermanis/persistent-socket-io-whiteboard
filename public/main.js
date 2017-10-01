'use strict';

(function () {

    var socket = io();
    var canvas = document.getElementsByClassName('whiteboard')[0];
    var colors = document.getElementsByClassName('color');
    var tools = document.getElementsByClassName('tool');
    var context = canvas.getContext('2d');

    var story = {
        width: 10,
        height: 10
    }

    // Shared State Objects
    var current = {
        color: 'black',
        tool: 'pen',
        valid: false,
        shapes: []
    };

    // Individual State Objects
    var drawing = false;
    var dragging = false;
    var selection = null;
    var dragOffsetX0 = 0;
    var dragOffsetY0 = 0;
    var dragOffsetX1 = 0;
    var dragOffsetY1 = 0;

    canvas.addEventListener('mousedown', onMouseDown, false);
    canvas.addEventListener('mouseup', onMouseUp, false);
    canvas.addEventListener('mouseout', onMouseUp, false);
    canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

    for (var i = 0; i < colors.length; i++) {
        colors[i].addEventListener('click', onColorUpdate, false);
    }

    for (var j = 0; j < tools.length; j++){
        tools[j].addEventListener('click', onToolUpdate, false);
    }

    socket.on('pen', onDrawingEvent);
    socket.on('story', onStoryEvent);
    socket.on('update', onUpdateEvent);

    window.addEventListener('resize', onResize, false);
    onResize();


    // Shape Prototype
    function Shape(x0, y0, type, color, text, x1, y1) {
        this.type = type || '';
        this.x0 = x0 || 0;
        this.y0 = y0 || 0;
        this.x1 = x1 || 0;
        this.y1 = y1 || 0;
        this.color = color || '#AAAAAA';
        this.text = text || '';
    }

    Shape.prototype.draw = function() {
        if (this.type === 'line') {
            drawLine(this.x0, this.y0, this.x1, this.y1, this.color);
        }
        if (this.type === 'story') {
            drawStory(this.x0, this.y0, this.color, this.text);
        }
    }

    // Hit Detection:
    // Determine if a point is inside the shape's bounds
    Shape.prototype.contains = function(mx, my) {
        // All we have to do is make sure the Mouse X,Y fall in the area between
        // the shape's X and (X + Width) and its Y and (Y + Height)
        if (this.type === 'story') {
            return (this.x0 <= mx) && (this.x0 + story.width >= mx) &&
                (this.y0 <= my) && (this.y0 + story.height >= my);
        }
        if (this.type === 'line') {
            return (this.x0 < mx) && (this.x1 >= mx) &&
                (this.y0 < my) && (this.y0 >= my);
        }
    }

    // Drawing Functions
    function drawLine(x0, y0, x1, y1, color) {
        var w = canvas.width;
        var h = canvas.height;
        context.beginPath();
        context.moveTo(x0 * w, y0 * h);
        context.lineTo(x1 * w, y1 * h);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.stroke();
        context.closePath();
    }

    function drawStory(x, y, color, text, emit) {
        var w = canvas.width;
        var h = canvas.height;
        context.strokeStyle = color;
        context.rect(x * w,y * h, w * (story.width / 100), h * (story.height / 100));
        context.stroke();

        // TODO - Add text
    }

    function emitUpdate() {
        var w = canvas.width;
        var h = canvas.height;
        for (var i = 0; i < current.shapes.length; i++) {
            var shape = current.shapes[i];
            shape.x0 = shape.x0 / w;
            shape.x1 = shape.x1 / w;
            shape.y0 = shape.y0 / h;
            shape.y1 = shape.y1 / h;
        }
        socket.emit('update', {
            shapes: current.shapes
        })
    }

    function redrawShapes() {
        if (!current.valid) {
            var shapes = current.shapes;
            context.clearRect(0,0, canvas.width, canvas.height);

            var l = shapes.length;
            for (var i = 0; i < l; i++) {
                var shape = shapes[i];
                // Skip Out of bounds or empty shapes
                if (shape.x0 > canvas.width || shape.y0 > canvas.height ||
                    shape.x0 + shape.w < 0 || shape.y0 + shape.h < 0) continue;
                shape.draw();
            }

            if (selection != null) {
                context.strokeStyle = selectionColor;
                context.lineWidth = selectionWidth;
                var mySel = selection;
                if (selection.type === 'line') {
                    context.strokeRect(mySel.x0, mySel.y0,
                        (mySel.x0 < mySel.x1) ? (mySel.x1 - mySel.x0) : (mySel.x0 - mySel.x1),
                        (mySel.y0 < mySel.y1) ? (mySel.y1 - mySel.y0) : (mySel.y0 - mySel.y1));
                }
                if (selection.type === 'story') {
                    context.strokeRect(mySel.x0, mySel.y0, story.width, story.height);
                }
            }
        }
    }

    function selectShape(x, y) {
        var shapes = current.shapes;
        var length = shapes.length;
        //Start at the last object (LIFO), to pick the "top" shape
        for (var i = length-1; i >= 0;i--) {
            if (shapes[i].contains(x, y)) {
                var mySelected = shapes[i];
                dragOffsetX0 =  x - mySelected.x0;
                dragOffsetY0 = y - mySelected.y0;
                dragOffsetX1 = x - mySelected.x1;
                dragOffsetY1 = y - mySelected.y1;
                dragging = true;
                selection = mySelected;
                dragging = true;
                current.valid = false;
                return;
            }
        }
        if (selection) {
            selection = null;
            current.valid = false;
        }
    }

    function addStory(x, y, color, text) {
        var shape = new Shape(x, y, 'story', color, text);
        current.shapes.push(shape);
        current.valid = false;
        emitUpdate();
        redrawShapes();
    }

    function addLine(x0, y0, color, x1, y1) {
        var shape = new Shape(x0, y0, 'line', color, '', x1, y1);
        current.shapes.push(shape);
        current.valid = false;
        emitUpdate();
        redrawShapes();
    }

    // Mouse Events
    function onMouseDown(e) {
        if (current.tool === 'pen') {
            drawing = true;
            current.x = e.clientX;
            current.y = e.clientY;
            return;
        }
        if (current.tool === 'story') {
            addStory(e.clientX, e.clientY, current.color);
            return;
        }
        if (current.tool === 'move') {
            selectShape(e.clientX, e.clientY);
            return;
        }
    }

    function onMouseUp(e) {
        if (current.tool === 'pen' && drawing) {
            drawing = false;
            addLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
            return;
        }
        if (current.tool === 'move' && dragging) {
            dragging = false;
            emitMove(selection);
        }
    }

    function onMouseMove(e) {
        if (drawing) {
            addLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
            current.x = e.clientX;
            current.y = e.clientY;
            return;
        }
        if (dragging) {
            selection.x0 = e.clientX - dragOffsetX0;
            selection.y0 = e.clientY - dragOffsetY0;
            selection.x1 = e.clientX - dragOffsetX1;
            selection.y1 = e.clientY - dragOffsetY1;
            current.valid = false;
        }
    }


    // User Events
    function onColorUpdate(e) {
        current.color = e.target.className.split(' ')[1];
    }

    function onToolUpdate(e) {
        current.tool = e.target.className.split(' ')[1];
    }

    // limit the number of events per second
    function throttle(callback, delay) {
        var previousCall = new Date().getTime();
        return function () {
            var time = new Date().getTime();

            if ((time - previousCall) >= delay) {
                previousCall = time;
                callback.apply(null, arguments);
            }
        };
    }


    // Socket Events

    function onDrawingEvent(data) {
        var w = canvas.width;
        var h = canvas.height;
        drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
    }

    function onStoryEvent(data) {
        var w = canvas.width;
        var h = canvas.height;
        drawStory(data.x * w, data.y * h, data.color);
    }

    function onUpdateEvent(data) {
        var w = canvas.width;
        var h = canvas.height;
        var shapes = data.shapes;
        var updatedShapes = [];
        for (var i = 0; i < shapes.length; i++) {
            var shape = shapes[i];
            shape.x0 = shape.x0 * w;
            shape.x1 = shape.x1 * w;
            shape.y0 = shape.y0 * h;
            shape.y1 = shape.y1 * h;
            updatedShapes.push(shape);
        }
        current.shapes = updatedShapes;
        redrawShapes();
    }

    // make the canvas fill its parent
    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }


    // Options
    var selectionColor = '#CC0000';
    var selectionWidth = 2;
    var interval = 30;
    setInterval(function() {redrawShapes(); }, interval);

})();
