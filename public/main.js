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

    var current = {
        color: 'black',
        tool: 'pen'
    };
    var drawing = false;

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

    window.addEventListener('resize', onResize, false);
    onResize();


    function drawLine(x0, y0, x1, y1, color, emit) {
        context.beginPath();
        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.stroke();
        context.closePath();

        if (!emit) {
            return;
        }
        var w = canvas.width;
        var h = canvas.height;

        socket.emit('pen', {
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color
        });
    }

    function drawStory(x, y, color, emit) {
        var w = canvas.width;
        var h = canvas.height;
        context.strokeStyle = color;
        context.rect(x,y, w * (story.width / 100), h * (story.height / 100));
        context.stroke();

        if (!emit) { return; }
        // find the dimensions of the drawer's canvas


        // Emit the event, sending the position as a percentage of the canvas, to normalize
        socket.emit('story', {
            x: x / w,
            y: y / h
        });

    }

    function onMouseDown(e) {
        if (current.tool === 'pen') {
            drawing = true;
            current.x = e.clientX;
            current.y = e.clientY;
        } else if (current.tool === 'story') {
            drawStory(e.clientX, e.clientY, current.color, true);
        }
    }

    function onMouseUp(e) {
        if (current.tool === 'pen' && drawing) {
            drawing = false;
            drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
        }
    }

    function onMouseMove(e) {
        if (!drawing) {
            return;
        }
        drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
        current.x = e.clientX;
        current.y = e.clientY;
    }

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

    // make the canvas fill its parent
    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

})();
