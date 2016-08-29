/*jslint browser: true, plusplus: true */
/*global angular */

(function () {
    'use strict';

    var CLS_VIEWKEEPER_FIXED = 'bb-viewkeeper-fixed',
        CLS_VIEWKEEPER_NO_OMNIBAR = 'bb-viewkeeper-no-omnibar',
        marginBottomOverrides = [],
        marginTopOverrides = [],
        config = {
            viewportMarginTop: 0,
            hasOmnibar: true
        },
        ViewKeeper;

    function nextId() {
        nextId.index = nextId.index || 0;
        nextId.index++;
        return 'viewkeeper-' + nextId.index;
    }

    function getSpacerId(vk) {
        return vk.id + "-spacer";
    }

    function setElPosition(elQ, left, top, bottom, width) {
        elQ.css({
            "top": top,
            "bottom": bottom,
            "left": left
        });

        /*istanbul ignore else*/
        /* sanity check */
        if (width !== null) {
            elQ.css({ "width": width });
        }
    }

    function fixEl(vk, boundaryInfo, fixedStyles) {
        var elQ = angular.element(vk.el),
            spacerHeight,
            width;

        if (boundaryInfo.spacerQ.length === 0) {
            if (vk.setPlaceholderHeight) {
                spacerHeight = boundaryInfo.elHeight;
            } else {
                spacerHeight = 0;
            }
            elQ.after(
                '<div id="' + 
                boundaryInfo.spacerId + 
                '" style="height: ' + 
                spacerHeight + 
                'px;"></div>'
            );
        }

        elQ.addClass(CLS_VIEWKEEPER_FIXED);

        vk.currentElFixedTop = fixedStyles.elFixedTop;
        vk.currentElFixedBottom = fixedStyles.elFixedBottom;
        vk.currentElFixedLeft = fixedStyles.elFixedLeft;
        vk.currentElFixedWidth = fixedStyles.elFixedWidth;

        if (vk.setWidth) {
            width = fixedStyles.elFixedWidth;
        }

        setElPosition(
            elQ, 
            fixedStyles.elFixedLeft, 
            fixedStyles.elFixedTop, 
            fixedStyles.elFixedBottom, 
            width
        );
    }

    function unfixEl(vk) {
        var elQ = angular.element(vk.el),
            width;

        angular.element("#" + getSpacerId(vk)).remove();

        elQ.removeClass(CLS_VIEWKEEPER_FIXED);

        vk.currentElFixedLeft = null;
        vk.currentElFixedTop = null;
        vk.currentElFixedBottom = null;
        vk.currentElFixedWidth = null;

        if (vk.setWidth) {
            width = "auto";
        }
        setElPosition(elQ, "", "", "", width);
    }

    function getViewportMarginTop() {
        return marginTopOverrides.length > 0 ? 
            marginTopOverrides[marginTopOverrides.length - 1].margin : 
            config.viewportMarginTop;
    }

    function getViewportMarginBottom() {
        return marginBottomOverrides.length > 0 ? 
            marginBottomOverrides[marginBottomOverrides.length - 1].margin : 
            0;
    }

    function calculateVerticalOffset(vk) {
        var offset,
            verticalOffSetElTop;

        offset = vk.verticalOffSet;

        if (vk.verticalOffSetEl) {
            verticalOffSetElTop = vk.verticalOffSetEl.css('top');

            /*istanbul ignore else*/
            /* sanity check */
            if (verticalOffSetElTop) {
                verticalOffSetElTop = parseInt(verticalOffSetElTop, 10);
                if (isNaN(verticalOffSetElTop)) {
                    verticalOffSetElTop = 0;
                }
            }

            offset += (vk.verticalOffSetEl.outerHeight() + verticalOffSetElTop);
        }

        return offset;
    }

    function getBoundaryInfo(vk) {
        var boundaryBottom,
            boundaryOffset,
            boundaryTop,
            boundaryQ,
            documentQ,
            elQ,
            scrollLeft,
            scrollTop,
            spacerId,
            spacerQ,
            elHeight;

        elQ = angular.element(vk.el);

        boundaryQ = angular.element(vk.boundaryEl);
        spacerId = getSpacerId(vk);

        spacerQ = angular.element("#" + spacerId);
        documentQ = angular.element(window.document);

        boundaryOffset = boundaryQ.offset();
        boundaryTop = boundaryOffset.top;
        boundaryBottom = boundaryTop + boundaryQ.height();

        scrollLeft = documentQ.scrollLeft();
        scrollTop = documentQ.scrollTop();

        elHeight = elQ.outerHeight(true);

        return {
            boundaryBottom: boundaryBottom,
            boundaryOffset: boundaryOffset,
            boundaryQ: boundaryQ,
            elHeight: elHeight,
            scrollLeft: scrollLeft,
            scrollTop: scrollTop,
            spacerId: spacerId,
            spacerQ: spacerQ
        };
    }

    function shouldFixEl(vk, boundaryInfo, verticalOffSet) {
        var anchorHeight,
            anchorTop,
            doFixEl,
            elQ;

        elQ = angular.element(vk.el);

        if (boundaryInfo.spacerQ.length > 0) {
            anchorTop = boundaryInfo.spacerQ.offset().top;
            anchorHeight = boundaryInfo.spacerQ.outerHeight(true);
        } else {
            anchorTop = elQ.offset().top;
            anchorHeight = boundaryInfo.elHeight;
        }

        if (vk.fixToBottom) {
            //Fix el if the natural bottom of the element would not be on the screen
            doFixEl = 
                anchorTop + anchorHeight > 
                boundaryInfo.scrollTop + (window.innerHeight - getViewportMarginBottom());
        } else {
            doFixEl = boundaryInfo.scrollTop + verticalOffSet + getViewportMarginTop() > anchorTop;
        }

        return doFixEl;
    }

    function getFixedStyles(vk, boundaryInfo, verticalOffSet) {
        var elFixedBottom,
            elFixedLeft,
            elFixedTop,
            elFixedWidth;

        if (vk.fixToBottom) {
            elFixedBottom = getViewportMarginBottom();
        } else {
            // If the element needs to be fixed, this will calculate its position.  The position 
            // will be 0 (fully visible) unless the user is scrolling the boundary out of view.  
            // In that case, the element should begin to scroll out of view with the
            // rest of the boundary by setting its top position to a negative value.
            elFixedTop = Math.min(
                (boundaryInfo.boundaryBottom - boundaryInfo.elHeight) - boundaryInfo.scrollTop, 
                verticalOffSet
            );
        }

        elFixedWidth = boundaryInfo.boundaryQ.width();
        elFixedLeft = boundaryInfo.boundaryOffset.left - boundaryInfo.scrollLeft;

        return {
            elFixedBottom: elFixedBottom,
            elFixedLeft: elFixedLeft,
            elFixedTop: elFixedTop,
            elFixedWidth: elFixedWidth
        };
    }

    function needsUpdating(vk, doFixEl, fixedStyles) {
        if (
            (
                doFixEl && 
                vk.currentElFixedLeft === fixedStyles.elFixedLeft && 
                vk.currentElFixedTop === fixedStyles.elFixedTop && 
                vk.currentElFixedBottom === fixedStyles.elFixedBottom && 
                vk.currentElFixedWidth === fixedStyles.elFixedWidth
            ) || 
            (
                !doFixEl && 
                !(vk.currentElFixedLeft !== undefined && vk.currentElFixedLeft !== null)
            )
        ) {
            // The element is either currently fixed and its position and width do not need 
            // to change, or the element is not currently fixed and does not need to be fixed.  
            // No changes are needed.
            return false;
        }

        return true;
    }

    ViewKeeper = function (options) {
        var id,
            vk = this;

        options = options || /* istanbul ignore next */ {};

        vk.fixToBottom = options.fixToBottom;
        vk.setWidth = options.setWidth;
        vk.id = id = nextId();
        vk.el = options.el;
        vk.boundaryEl = options.boundaryEl;
        vk.verticalOffSet = options.verticalOffSet || 0;
        vk.setPlaceholderHeight = (options.setPlaceholderHeight !== false);
        vk.onStateChanged = options.onStateChanged;
        vk.isFixed = false;
        
        if (options.verticalOffSetElId) {
            vk.verticalOffSetEl = angular.element('#' + options.verticalOffSetElId);

            vk.verticalOffSetEl.on('afterViewKeeperSync.' + id, function () {
                vk.syncElPosition();
            });
        }

        angular.element(window).on("scroll." + id + ", resize." + id + ", orientationchange." + id, function () {
            vk.syncElPosition();
        });
    };

    ViewKeeper.prototype = {

        syncElPosition: function () {
            var boundaryInfo,
                doFixEl,
                isCurrentlyFixed,
                fixedStyles,
                elQ,
                verticalOffSet,
                vk = this;

            isCurrentlyFixed = vk.isFixed;

            verticalOffSet = calculateVerticalOffset(vk);

            elQ = angular.element(vk.el);

            // When the element isn't visible, its size can't be calculated, so don't attempt syncing position in this case.
            if (!elQ.is(':visible')) {
                return;
            }

            boundaryInfo = getBoundaryInfo(vk);
            fixedStyles = getFixedStyles(vk, boundaryInfo, verticalOffSet);

            doFixEl = shouldFixEl(vk, boundaryInfo, verticalOffSet);

            if (needsUpdating(vk, doFixEl, fixedStyles)) {
                if (doFixEl) {
                    vk.isFixed = true;
                    fixEl(vk, boundaryInfo, fixedStyles);
                } else {
                    vk.isFixed = false;
                    unfixEl(vk);
                }

                //If we changed if the item is fixed, fire the callback
                if (vk.onStateChanged && isCurrentlyFixed !== vk.isFixed) {
                    vk.onStateChanged();
                }
            }
            elQ.trigger('afterViewKeeperSync');
        },

        scrollToTop: function () {
            var anchorTop,
                elQ,
                documentQ,
                spacerId,
                spacerQ,
                verticalOffset,
                vk = this;

            verticalOffset = calculateVerticalOffset(vk);

            documentQ = angular.element(window.document);
            spacerId = getSpacerId(vk);
            spacerQ = angular.element("#" + spacerId);
            elQ = angular.element(vk.el);

            if (spacerQ.length > 0) {
                anchorTop = spacerQ.offset().top;
            } else {
                anchorTop = elQ.offset().top;
            }

            documentQ.scrollTop(anchorTop - verticalOffset - getViewportMarginTop());
        },

        destroy: function () {
            var id,
                vk = this;

            if (!vk.isDestroyed) {
                id = vk.id;

                angular.element(window).off("scroll." + id + ", resize." + id + ", orientationchange." + id);
                unfixEl(vk);

                if (vk.verticalOffSetEl) {
                    vk.verticalOffSetEl.off("afterViewKeeperSync." + vk.id);
                    vk.verticalOffSetEl = null;
                }

                vk.isDestroyed = true;
            }
        }

    };

    angular.module('sky.viewkeeper', ['sky.mediabreakpoints', 'sky.window'])
        .constant('bbViewKeeperConfig', config)
        .factory('bbViewKeeperBuilder', function () {
            return {
                create: function (options) {
                    return new ViewKeeper(options);
                },
                addViewportMarginBottomOverride: function (value) {
                    marginBottomOverrides.push(value);
                },
                removeViewportMarginBottomOverride: function (value) {
                    var index = marginBottomOverrides.indexOf(value);

                    /*istanbul ignore else */
                    if (index > -1) {
                        marginBottomOverrides.splice(index, 1);
                    }
                },
                addViewportMarginTopOverride: function (value) {
                    marginTopOverrides.push(value);
                },
                removeViewportMarginTopOverride: function (value) {
                    var index = marginTopOverrides.indexOf(value);

                    /*istanbul ignore else */
                    if (index > -1) {
                        marginTopOverrides.splice(index, 1);
                    }
                }
            };
        })
        .run(['$document', '$window', 'bbMediaBreakpoints', 'bbViewKeeperConfig', function ($document, $window, bbMediaBreakpoints, bbViewKeeperConfig) {
            function mediaBreakpointHandler(breakpoints) {
                //For user agents in which the omnibar follows you down the page, the ViewKeeper needs
                //to adjust for the height of the omnibar.
                if (bbViewKeeperConfig.hasOmnibar) {
                    //Ideally these values should be driven from a more appropriate source (omnibar js?)
                    bbViewKeeperConfig.viewportMarginTop = breakpoints.xs ? 50 : 30;
                    angular.element('body').removeClass(CLS_VIEWKEEPER_NO_OMNIBAR);
                } else {
                    angular.element('body').addClass(CLS_VIEWKEEPER_NO_OMNIBAR);
                }
            }

            if (/iPad|iPod|iPhone/i.test($window.navigator.userAgent)) {
                //On iOS the omnibar doesn't scroll with you.  Need to account for this on the styling.
                angular.element('body').addClass('omnibar-not-fixed');

                //On iOS we need to have special handling when entering textboxes to correct an issue with fixed
                //elements used by view keeper when the keyboard flys out.
                angular.element(document).on('focus', 'input', function () {
                    angular.element('body').addClass('bb-viewkeeper-ignore-fixed');
                }).on('blur', 'input', function () {
                    angular.element('body').removeClass('bb-viewkeeper-ignore-fixed');
                });
            } else {
                bbMediaBreakpoints.register(mediaBreakpointHandler);
            }
        }])
        .directive('bbViewKeeper', ['bbViewKeeperBuilder', function (bbViewKeeperBuilder) {
            function link(scope, el) {
                var vk;

                function destroyVk() {
                    if (vk) {
                        vk.destroy();
                        vk = null;
                    }
                }

                el.on('$destroy', function () {
                    destroyVk();
                });

                scope.$watch('bbBoundaryElId', function () {
                    var boundaryEl,
                        bbBoundaryElId = scope.bbBoundaryElId;

                    /*istanbul ignore else */
                    if (bbBoundaryElId) {
                        boundaryEl = angular.element('#' + bbBoundaryElId);

                        /*istanbul ignore else */
                        if (boundaryEl.length === 1) {
                            destroyVk();

                            vk = bbViewKeeperBuilder.create({
                                el: el[0],
                                boundaryEl: boundaryEl[0],
                                setWidth: true
                            });
                        }
                    }
                });
            }
            return {
                link: link,
                restrict: 'A',
                scope: {
                    bbBoundaryElId: '='
                }
            };
        }])
        .directive('bbScrollingViewKeeper', ['$window', 'bbWindow', function ($window, bbWindow) {
            return {
                scope: {
                    bbScrollingViewKeeper: "="
                },
                link: function (scope, element) {
                    var elementStart,
                        scrollPos,
                        prevScroll,
                        scrollingDown = true,
                        tempTop,
                        verticalOffset,
                        id = scope.$id;

                    function scroll() {
                        if (!element.is(':visible')) {
                            return;
                        }

                        if (angular.element('.bb-omnibar>.desktop').is(':visible')) {
                            verticalOffset = angular.element('.bb-omnibar>.desktop>.bar').outerHeight();
                        } else {
                            verticalOffset = 0;
                        }

                        if (scope.bbScrollingViewKeeper && scope.bbScrollingViewKeeper.viewKeeperOffsetElId) {
                            verticalOffset += angular.element('#' + scope.bbScrollingViewKeeper.viewKeeperOffsetElId).outerHeight();
                        }

                        if (!elementStart) {
                            elementStart = element.offset().top;
                        }
                        scrollPos = $window.scrollY || $window.pageYOffset || $window.document.body.scrollTop || 0;
                        if (prevScroll > scrollPos) {
                            scrollingDown = false;
                        } else {
                            scrollingDown = true;
                        }
                        prevScroll = scrollPos;

                        if (scrollPos >= elementStart - verticalOffset && element.height() + verticalOffset <= $window.document.body.offsetHeight) {
                            if (element.height() + verticalOffset < $window.innerHeight) {
                                tempTop = 0;

                                element.removeClass('bb-grid-filters-fixed-bottom').addClass('bb-grid-filters-fixed-top');

                                element.css({
                                    top: verticalOffset + 'px'
                                });
                            } else if (scrollingDown) {
                                if (element.offset().top + element.height() >= scrollPos + $window.innerHeight) {
                                    /*istanbul ignore else*/
                                    /* sanity check */
                                    if (!tempTop) {
                                        tempTop = element.offset().top - elementStart;
                                    }

                                    element.removeClass('bb-grid-filters-fixed-top bb-grid-filters-fixed-bottom');

                                    element.css({
                                        top: tempTop
                                    });
                                } else {
                                    tempTop = 0;
                                    element.css({
                                        top: ''
                                    });
                                    element.removeClass('bb-grid-filters-fixed-top').addClass('bb-grid-filters-fixed-bottom');
                                }
                            } else {
                                if (element.offset().top < scrollPos + verticalOffset) {
                                    /*istanbul ignore else*/
                                    /* sanity check */
                                    if (!tempTop) {
                                        tempTop = element.offset().top - elementStart;
                                    }

                                    element.removeClass('bb-grid-filters-fixed-top bb-grid-filters-fixed-bottom ');

                                    element.css({
                                        top: tempTop
                                    });
                                } else {
                                    tempTop = 0;

                                    element.removeClass('bb-grid-filters-fixed-bottom').addClass('bb-grid-filters-fixed-top');

                                    element.css({
                                        top: verticalOffset + 'px'
                                    });
                                }
                            }
                        } else {
                            tempTop = 0;
                            element.removeClass('bb-grid-filters-fixed-top bb-grid-filters-fixed-bottom grid-filters-fixed-top grid-filters-fixed-bottom');
                            element.css({
                                top: 0
                            });
                        }
                    }

                    if (!bbWindow.isIosUserAgent()) {
                        angular.element($window).on('scroll.' + id + ', orientationchange.' + id, scroll);

                        element.on('$destroy', function () {
                            angular.element($window).off("scroll." + id + ", orientationchange." + id);
                        });
                    }
                },
                restrict: 'A'
            };
        }]);
}());
