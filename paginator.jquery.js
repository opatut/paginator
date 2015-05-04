var makeSubscribable = function (events, obj) {
    if (typeof obj === 'undefined') {
        obj = {};
    }

    var subscribers = {};

    for (i in events) {
        subscribers[events[i]] = [];
    }

    obj.on = function (event, callback) {
        // check if event is valid event
        if (events.indexOf(event) === -1) {
            throw new Error("Invalid event: " + event);
        }

        subscribers[event].push(callback);

        return obj;
    };

    obj.off = function (event, callback) {
        subscribers[event] = subscribers[event].filter(function (fn) {
            return fn != callback;
        });

        return obj;
    };

    obj.handleEvent = function (event, arguments) {
        for (i in subscribers[event]) {
            subscribers[event][i].apply(obj, arguments);
        };

        return obj;
    };

    return obj;
};

var clamp = function (val, min, max) {
    return Math.min(Math.max(min, val), max);
};

$.fn.paginator = function (options) {
    var paginator = makeSubscribable(['pageChanged', 'offsetChanged']);

    var $node           = $(this);
    var $pagesContainer = $node.find('.pages').eq(0);
    var $pages          = $pagesContainer.children();

    if (typeof options == 'undefined') {
        options = {};
    }

    options = $.extend({}, $.fn.paginator.defaults, options);

    var $currentPage;
    var currentIndex;
    var draggingStart, draggingOffset, draggingPosition, draggingTime, velocity;
    var velocity = 0;

    var getPageCount = function () {
        return $pages.length;
    };

    var updateStyles = function (progress, animateDuration) {
        if (typeof progress === 'undefined') {
            progress = currentIndex;
        }

        if (typeof animateDuration === 'undefined') {
            animateDuration = options.animateDuration;
        }

        // remove all 'offset-*' classes
        for (var i = 0; i < getPageCount(); ++i) {
            $pages.removeClass('offset-' + i);
        }

        $pages.each(function (index) {
            var $page = $(this);
            var offset = index - progress;

            // enable/disable transition
            $page.css({"transition": "all " + (animateDuration/1000) + "s"});

            // direct styling
            var pageTransform = options.pageTransform;
            if (typeof pageTransform === 'string' && pageTransform in $.fn.paginator.transforms) {
                pageTransform = $.fn.paginator.transforms[pageTransform].call(options.pageTransformArgs);
            }

            if (typeof pageTransform === 'function') {
                var css = pageTransform(offset, index, $page);

                if (css) {
                    $page.css(css);
                }
            }

            // classes
            var classOffset = Math.round(offset);
            $page.toggleClass('current', classOffset == 0);
            $page.toggleClass('left', classOffset < 0);
            $page.toggleClass('right', classOffset > 0);
            $page.addClass('offset-' + Math.abs(classOffset));
        });

        // calculate factors on 'how much' each page is shown
        var pageFactors = [];

        for (var i = 0; i < getPageCount(); ++i) {
            pageFactors.push(Math.max(0, 1 - Math.abs(i - progress)));
        }

        paginator.handleEvent('offsetChanged', [progress, pageFactors]);
    };

    var linkNavigationList = function ($listItems, currentClass, events) {
        if (typeof currentClass === 'undefined') {
            currentClass = 'current';
        }

        if (typeof events === 'undefined') {
            events = 'click';
        }

        // function to assign currentClass to the currently active navigation item
        var update = function (index) {
            $listItems.removeClass(currentClass).eq(index).addClass(currentClass);
        };

        paginator.on('pageChanged', update);
        update(currentIndex);

        // bind click events for links/buttons inside items
        if (events !== false) {
            $listItems.each(function (idx) {
                var onClick = function (e) {
                    setCurrentPage(idx);
                    e.preventDefault();
                    e.stopPropagation();
                };

                $(this).find('a, button').on(events, onClick);
                $(this).on(events, onClick);
            });
        }
    };

    var updateSize = function (animateDuration) {
        // ignore this function call in 'autosize' mode (CSS only)
        if ($node.hasClass('autosize')) {
            return;
        }

        if (typeof animateDuration === 'undefined') {
            animateDuration = options.animateDuration;
        }

        $pagesContainer.css({"transition": "height " + (animateDuration/1000) + "s, width " + (animateDuration/1000) + "s"});
        $pagesContainer.width($currentPage.innerWidth());
        $pagesContainer.height($currentPage.innerHeight());
    };

    var startDragging = function (eventPageX) {
        draggingPosition = currentIndex;
        draggingStart = currentIndex;
        draggingOffset = eventPageX;
        draggingTime = new Date();
        velocity = 0;
    };

    var updateDragging  = function (eventPageX) {
        if (typeof draggingOffset != 'undefined') {
            var dragDistancePerPage = options.dragDistancePerPage;
            if (dragDistancePerPage == 'auto') {
                dragDistancePerPage = $currentPage.width();
            }

            // calculate position offset
            var offsetDiff = (draggingOffset - eventPageX) / dragDistancePerPage;
            var newPosition = draggingStart + offsetDiff
            var frameDifference = newPosition - draggingPosition;

            // calculate velocity
            var frameDuration = (new Date().getTime() - draggingTime.getTime()) / 1000.0;

            if (frameDuration > 0) {
                var frameVelocity = (frameDifference / frameDuration) || 0;
                var fac = Math.min(1, frameDuration) * 5;
                velocity = fac * frameVelocity + (1 - fac) * velocity;
            }

            draggingTime = new Date();
            draggingPosition = newPosition;

            // TODO: overshoot
            draggingPosition = clamp(draggingPosition, 0, getPageCount() - 1);

            updateStyles(draggingPosition, 0);
        }
    };

    var stopDragging = function (pageX) {
        if (typeof draggingPosition !== 'undefined') {
            // trigger an update to fix velocity
            if (typeof pageX !== 'undefined') {
                updateDragging(pageX);
            }

            var page = Math.round(draggingPosition);
            page = Math.min(getPageCount() - 1, Math.max(0, page));

            var slidingPosition = draggingPosition;
            var slidingLastTime = new Date();

            if (Math.abs(velocity) < 0.1) {
                setCurrentPage(page);
            } else {
                $({velocity: velocity}).animate({velocity: 0}, {
                    step: function () {
                        slidingPosition += this.velocity * (new Date().getTime() - slidingLastTime) * 0.001;
                        slidingLastTime = new Date();
                        updateStyles(slidingPosition, 0);
                    },
                    complete: function () {
                        setCurrentPage(Math.round(slidingPosition));
                    }
                });
            }

            draggingPosition = undefined;
            draggingOffset   = undefined;
            draggingStart    = undefined;
        }
    };

    var getCurrentPage = function () {
        return currentIndex;
    }

    var setCurrentPage = function (index, animateDuration) {
        var count = getPageCount();

        // clamping
        index = clamp(index, 0, count - 1);

        if (typeof options.allowPageChange === 'function' ?
                !options.allowPageChange(currentIndex, index) :
                !options.allowPageChange) {
            return false;
        }

        currentIndex = index;
        $currentPage = $pages.eq(currentIndex);

        updateStyles(currentIndex, animateDuration);
        updateSize(animateDuration);

        paginator.handleEvent('pageChanged', [currentIndex, $currentPage]);
    };

    var next = function () {
        var newIndex = currentIndex + 1;
        var count = getPageCount();

        if (options.rewind) {
            newIndex = (newIndex + count) % count;
        }

        return setCurrentPage(newIndex);
    };

    var prev = function () {
        var newIndex = currentIndex - 1;
        var count = getPageCount();

        if (options.rewind) {
            newIndex = (newIndex + count) % count;
        }

        return setCurrentPage(newIndex);
    };

    // initialize
    setCurrentPage(options.initialPage, 0);

    // bind actions on elements inside paginator node
    if (options.bindActions) {
        $node.find("[data-action]").click(function(e) {
            // make sure $(this) is not inside a nested paginator
            if (!$(this).parents('.paginator').eq(0).is($node)) {
                return;
            }


            var action = $(this).attr("data-action");

            if (action == "prev") {
                prev();
                e.preventDefault();
            } else if (action == "next") {
                next();
                e.preventDefault();
            } else if (action == "setCurrentPage" || action == "setPage") {
                var target = $(this).data('page');

                if (target == "last") {
                    target = getPageCount();
                } else if (target == "first") {
                    target = 0;
                } else if (target < 0) {
                    target = getPageCount() + target;
                } else {
                    target = 0 + target; // convert to integer
                }

                setCurrentPage(target);
                e.preventDefault();
            }
        });
    }

    if (options.dragEnabled) {
        $pagesContainer.on('touchstart', function(e) {
            startDragging(e.originalEvent.touches[0].pageX);
        });

        $pagesContainer.on('touchmove', function(e) {
            updateDragging(e.originalEvent.touches[0].pageX);
        });

        $('body').on('touchend', function(e) {
            stopDragging();
        });

        $pagesContainer.on('mousedown', function(e) {
            startDragging(e.originalEvent.pageX);
        });

        $('body').on('mousemove', function(e) {
            updateDragging(e.originalEvent.pageX);

            if (typeof draggingPosition !== 'undefined') {
                e.preventDefault();
            }
        });

        $('body').on('mouseup', function(e) {
            stopDragging(e.originalEvent.pageX);
        });
    };

    var setPageTransform = function (pageTransform) {
        options.pageTransform = pageTransform;
        options.pageTransformArgs = Array.prototype.slice.call(arguments, 1);

        // reset page styles
        $pages.attr("style", "");
        updateStyles(currentIndex, 0);
    };


    // add functions to paginator object
    paginator.updateSize = updateSize;
    paginator.setCurrentPage = setCurrentPage;
    paginator.getCurrentPage = getCurrentPage;
    paginator.getPageCount = getPageCount;
    paginator.setPageTransform = setPageTransform;
    paginator.prev = prev;
    paginator.next = next;
    paginator.linkNavigationList = linkNavigationList;

    return paginator;
}

$.fn.paginator.defaults = {
    initialPage: 0,
    bindActions: true,
    animateDuration: 500,
    dragEnabled: true,
    dragDistancePerPage: 'auto',
    pageTransform: null,
    rewind: false,
    pageTransformArgs: [],
    allowPageChange: true
};

$.fn.paginator.transforms = {
    slide: function() {
        return function (offset) {
            return {
                transform: "translate(" + 100*offset + "%, 0)"
            };
        };
    },
    slideVertical: function() {
        return function (offset) {
            return {
                transform: "translate(0, " + 100*offset + "%)"
            };
        };
    },
    fade: function() {
        return function (offset) {
            return {
                opacity: Math.max(0, 1 - Math.abs(offset))
            };
        };
    },
    stack: function () {
        return function (offset, index, $page) {
            var sign = (offset/Math.abs(offset)) || 0;

            return {
                transform: "translate(" + (offset < 0 ? 100*offset : 0) + "%, 0) scale(" + (offset > 0 ? 1-(0.5*offset) : 1) + ")",
                opacity: (offset > 0 ? Math.max(0, 1 - offset) : 1),
                "z-index": 1000-index
            };
        };
    },
    zoom: function () {
        return function (offset, index, $page) {
            return {
                transform: "scale(" + Math.max(0, 1 - offset) + ")",
                opacity: Math.max(0, 1 - Math.abs(offset))
            };
        };
    }
}
