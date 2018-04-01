// Type Matrix is [ [a00, a10], [a01, a11] ]
// Type Vector is [ x, y ]
// Type Transform is [ Matrix, Vector ]

/**
 * Multiply Scalar with Vector returns a Vector.
 * 
 * @param {number} l scalar to multiply with
 * @param {Array<number>} x 2D vector.
 * @return {Array<number>}
 */
var scmult = function(l, x) {
    return [ l * x[0], l * x[1] ];
};

/**
 * Adding two vectors is another vector.
 * 
 * @param {Array<number>} a 2D vector.
 * @param {Array<number>} b 2D vector.
 * @return {Array<number>} Sum vector.
 */
var vcadd = function(a, b) {
    return [ a[0] + b[0], a[1] + b[1] ];
};

/**
 * Subtracting two vectors is another vector.
 * 
 * @param {Array<number>} a 2D vector.
 * @param {Array<number>} b 2D vector.
 * @return {Array<number>} Difference vector.
 */
var minus = function(a, b) {
    return [ a[0] - b[0], a[1] - b[1] ];
};

/**
 * Dot product of two vectors is scalar.
 * 
 * @param {Array<number>} a 2D vector.
 * @param {Array<number>} b 2D vector.
 * @return {number} scalar inner product.
 */
var dot = function(a, b) {
    return a[0] * b[0] + a[1] * b[1];
};

/**
 * Exterior Product of two vectors is a pseudoscalar.
 * 
 * @param {Array<number>} a 2D vector.
 * @param {Array<number>} b 2D vector.
 * @return {number} psuedo-scalar exterior product.
 */
var wedge = function(a, b) {
    return a[0] * b[1] - a[1] * b[0];
};

/**
 * Apply Matrix on Vector returns a Vector.
 * 
 * @param {Array<Array<number>>} A 2x2 Matrix
 * @param {Array<number>} x 2D vector.
 * @return {Array<number>} 2D vector linear product.
 */
var apply = function(A, x) {
    return vcadd(scmult(x[0], A[0]), scmult(x[1], A[1]));
};

/**
 * Multiply two matrices.
 * 
 * @param {Array<Array<number>>} A 2x2 Matrix
 * @param {Array<Array<number>>} B 2x2 Matrix
 * @return {Array<Array<number>>} A 2x2 Matrix
 */
var mult = function(A, B) {
    return [ apply(A, B[0]), apply(A, B[1]) ];
};

/**
 * Represents a transform operation, Ax + b
 * 
 * @constructor
 * 
 * @param {Array<Array<number>>} A 2x2 Matrix.
 * @param {Array<number>} b 2D scalar.
 */
function Transform(A, b, elem) {
    this.A = A;
    this.b = b;
    this.elem = elem;
}

/**
 * Given CSS Transform representation of the class.
 * @return {string} CSS 2D Transform. 
 */
Transform.prototype.css = function() {
    var A = this.A;
    var b = this.b;
    // Disable zoom out
    if (A[0][0] < 1) A[0][0] = 1;
    if (A[1][1] < 1) A[1][1] = 1;
    var elem = this.elem;
    if (elem) {
        // Set scroll top from element dataset
        var scrollTop = parseInt(elem.dataset.scrollTop);
        // If element has scroll top, set it in st, otherwise, use last saved scroll top
        var st = elem.scrollTop > 0 ? elem.scrollTop : scrollTop;
        // Calculate x and y axis pan borders
        var dy;
        if (screen.height <= elem.scrollHeight) {
            // Case screen height is lower then list
            dy = elem.scrollHeight * A[0][0] - screen.height - st*A[0][0];
        }
        else {
            // Case screen height is higer then list            
            dy = Math.abs(screen.height - elem.scrollHeight * A[0][0]);
        }
        var dx = elem.clientWidth * A[0][0] - elem.clientWidth;
        // Set pan borders
        if (b[1] > st*A[0][0]) b[1] = st*A[0][0];
        if (b[1] < -dy) b[1] = -dy;
        if (b[0] > 0) b[0] = 0;
        if (b[0] < -dx) b[0] = -dx;
        // Return false for scroll mode
        if (A[0][0] == 1 &&  A[1][1] == 1) {
            return false;
        }
        // calculate y axis pan
        var bb = b[1]-st*A[0][0];
        // Return pan and zoom matrix        
        return 'matrix(' + A[0][0] + ',' + A[0][1] + ',' + A[1][0] + ',' + A[1][1] +
                ',' + b[0] + ',' + bb + ')';
    }
};

/**
 * Multiply two transforms. 
 * Defined as 
 *  (T o U) (x) = T(U(x))
 * 
 * Derivation:
 *  T(U(x)) 
 *   = T(U.A(x) + U.b) 
 *   = T.A(U.A(x) + U.b)) + T.b
 *   = T.A(U.A(x)) + T.A(U.b) + T.b 
 * 
 * @param {Transform} T 
 * @param {Transform} U 
 * @return {Transform} T o U
 */
var cascade = function(T, U, elem) {
    return new Transform(mult(T.A, U.A), vcadd(apply(T.A, U.b), T.b), elem);
};

/**
 * Creates the default rotation matrix
 * 
 * @param {number} c x-projection (r cos(theta))
 * @param {number} s y-projection (r sin(theta))
 * @return {Array<Array<number>>} Rotation matrix.
 */
var rotate = function(c, s) {
    return [ [ c, s], [-s, c] ];
};

/**
 * Returns matrix that transforms vector a to vector b.
 * 
 * @param {Array<number>} a 2D vector.
 * @param {Array<number>} b 2D vector.
 * @return {Array<Array<number>>} Rotation + Scale matrix
 */
var rotscale = function(a, b) {
    var alen = dot(a, a);
    var sig = dot(a, b);
    var del = wedge(a, b);
    return rotate( sig / alen, del / alen);
};

var justscale = function(a, b) {
    var alen = Math.sqrt(dot(a, a));
    var blen = Math.sqrt(dot(b, b));
    var scale = blen / alen;
    return rotate(scale, 0)
};

/**
 * Zoom is a similarity preserving transform from a pair of source
 * points to a new pair of destination points. If rotate it is false
 * then it won't be maintaining the transfer precisely, but will only
 * do scaling part of it.
 * 
 * @param {Array<Array<number>>} s two source points.
 * @param {Array<Array<number>>} d two destination points.
 * @param {Boolean} rotate true - rotate; else scale.
 * 
 * @return {Transform} that moves point 's' to point 'd' 
 */ 
var zoom = function(s, d, rotate, elem) {
    // Source vector.
    var a = minus(s[1], s[0]);
    // Destination vector.
    var b = minus(d[1], d[0]);
    // Rotation needed for source to dest vector.
    var rs = rotate ? rotscale(a, b) : justscale(a, b);

    // Position of s[0] if rotation is applied.
    var rs0 = apply(rs, s[0]);
    // Since d[0] = rs0 + t
    var t = minus(d[0], rs0);

    return new Transform(rs, t, elem);
};

/**
 * Weighted average of two vectors.
 * 
 * @param {Array<number>} u 2D vector.
 * @param {Array<number>} v 2D vector.
 * @param {number} progress (from 0 to 1)
 * @return {Array<number>} (1-p) u + (p) v 
 */
var avgVector = function(u, v, progress) {
    var u1 = scmult(1 - progress, u);
    var v1 = scmult(progress, v);
    return vcadd(u1, v1);
};

/**
 * Weighted average of two vectors.
 * 
 * @return {Array<Array<number>>} A 2D matrix.
 * @return {Array<Array<number>>} B 2D matrix.
 * @param {number} progress (from 0 to 1)
 * @return {Array<Array<number>>} (1-p) A + (p) B 
 */
var avgMatrix = function(A, B, progress) {
    return [ avgVector(A[0], B[0], progress),  avgVector(A[1], B[1], progress) ];
};


/**
 * Weighted average of two transforms.
 * @param {Transform} Z Source Transform
 * @param {Transform} I Destination Transform
 * @param {number} progress (from 0 to 1)
 * @return {Transform} (1-p) Z + (p) I 
 */
Transform.avg = function(Z, I, progress) {
    return new Transform(avgMatrix(Z.A, I.A, progress), avgVector(Z.b, I.b, progress));
};

var identity = new Transform([[1, 0], [0, 1]], [0, 0]);

/**
 * Gives a default value for an input object.
 * 
 * @param {Object} param input parameter, may be undefined
 * @param {Object} val returned if param is undefined.
 * @return {Object}
 */
var defaults = function(param, val) {
    return (param == undefined) ? val : param;
};

/**
 * Method to override json config objects with default
 * values. If undefined in cfg corresponding value from
 * cfg_def will be picked.
 * 
 * @param {Object} cfg input parameter config.
 * @param {Object} cfg_def default fallbacks.
 * @return {Object} new config
 */
var default_config = function(cfg, cfg_def) {
    var new_cfg = defaults(cfg, {})
    for (k in cfg_def) {
        new_cfg[k] = defaults(new_cfg[k], cfg_def[k])
    }
    return new_cfg
};

/**
 * @constructor
 * @export
 * @param {Element} elem to attach zoom handler.
 * @param {Object} config to specify additiona features.
 */
function Zoom(elem, config, wnd) {
    this.elem = elem;
    this.zooming = false;
    this.activeZoom = identity;
    this.resultantZoom = identity;

    this.srcCoords = [0, 0];

    var me = this;
    me.inZoom = false;
    var tapped = false;

    this.config = default_config(config, {
        "pan" : false,
        "rotate" : true
    });

    this.wnd = wnd || window;

    elem.style['transform-origin'] = '0 0';

    var getCoordsDouble = function(t) {
        var oX = elem.offsetLeft;
        var oY = elem.offsetTop; 
        return [ 
            [t[0].pageX - oX, t[0].pageY - oY],
            [t[1].pageX - oX, t[1].pageY - oY] 
        ];
    };

    var getCoordsSingle = function(t) {
        var oX = elem.offsetLeft;
        var oY = elem.offsetTop; 
        var x = t[0].pageX - oX;
        var y = t[0].pageY - oY;
        return [ 
            [x, y],
            [x + 1, y + 1] 
        ];
    };

    var getCoords = function(t) {
        return t.length > 1 ? getCoordsDouble(t) : getCoordsSingle(t);
    };

    elem.parentNode.addEventListener('touchstart', function(evt) {
        var t = evt.touches;
        // Prevant zoom/pan while scrolling 
        if (!me.inZoom && !me.zooming){
            if (!t)
                return true;
            if (t.length !== 2) {
                return true;
            }
        }

        if (!t) {
            return false;
        }
        var do_reset = false;

        if (t.length === 2) {
            me.zooming = true;
        } else if (t.length === 1) {
            if (!tapped) {
                tapped = true;
                me.wnd.setTimeout(function() {
                    tapped = false;
                }, 300);
                if (me.config.pan) {
                    me.zooming = true;
                }
            } else {
                tapped = false;
                do_reset = true;
            }
        }
        if (me.zooming || tapped || do_reset) {
            evt.preventDefault();
        }
        if (me.zooming) {
            me.srcCoords = getCoords(t);
        }
        if (do_reset) {
            me.reset();
        }
    });
    
    elem.parentNode.addEventListener('touchmove', function(evt) {
        // Prevant zoom/pan while scrolling        
        if (!me.inZoom && !me.zooming){
            return;
        }
        var t = evt.touches;
    

        if (!t) {
            return false;
        }
        if (!me.zooming) {
            return false;
        }
        evt.preventDefault();
        var destCoords = getCoords(t);
        var additionalZoom = zoom(me.srcCoords, destCoords, me.config.rotate, this.elem);
        me.previewZoom(additionalZoom);
    });

    elem.parentNode.addEventListener('touchend', function(evt) {
        // Prevant zoom/pan while scrolling        
        if (!me.inZoom && !me.zooming){
            return;
        }
        if (me.zooming) {
            me.zooming = false;
            me.finalize();
            evt.preventDefault();
        }
    });
}

Zoom.prototype.previewZoom = function(additionalZoom) {
    this.resultantZoom = cascade(additionalZoom, this.activeZoom, this.elem);
    this.repaint();
};

Zoom.prototype.setZoom = function(newZoom) {
    this.resultantZoom = newZoom;
    this.finalize();
    this.repaint();
};

Zoom.prototype.finalize = function() {
    this.activeZoom = this.resultantZoom;
};

Zoom.prototype.repaint = function() {
    var css = this.resultantZoom.css();
    // Set relevant css attribiutes for zoom mode and scroll mode
    if (css) {
        if (this.elem.scrollTop > 0) this.elem.dataset.scrollTop = this.elem.scrollTop; 
        this.inZoom = true;
        this.elem.style.transform = this.resultantZoom.css();
        this.elem.style.overflow = "visible";
    }
    else {
        this.inZoom = false;
        this.elem.style.overflow = "scroll";
        this.elem.style.transform = "none";
    }
};

Zoom.prototype.reset = function() {
    if (this.wnd.requestAnimationFrame) {
        var Z = this.activeZoom;
        var startTime = null;

        var me = this;

        var step = function(time) {
            if (!startTime) { 
                startTime =  time;
            }
            var progress = (time - startTime)/100;
            if (progress >= 1) {
                me.setZoom(identity);
            } else {
                me.setZoom(Transform.avg(Z, identity, progress));
                me.wnd.requestAnimationFrame(step);
            }
        };
        this.wnd.requestAnimationFrame(step);
    } else {
        this.setZoom(identity);
    }
};
Zoom.prototype['reset'] = Zoom.prototype.reset;
if (typeof exports === "undefined") {
    window['Zoom'] = Zoom;
} else {
    exports['Zoom'] = Zoom;
}
