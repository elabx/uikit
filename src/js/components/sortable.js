function plugin(UIkit) {

    if (plugin.installed) {
        return;
    }

    var {mixin, util} = UIkit;
    var {addClass, after, assign, append, attr, before, closest, css, doc, docEl, height, getPos, includes, index, isInput, offset, off, on, pointerDown, pointerMove, pointerUp, preventClick, remove, removeClass, toggleClass, toNodes, trigger, win, within} = util;

    UIkit.component('sortable', {

        mixins: [mixin.class, mixin.animator],

        props: {
            group: String,
            threshold: Number,
            clsItem: String,
            clsPlaceholder: String,
            clsDrag: String,
            clsDragState: String,
            clsBase: String,
            clsNoDrag: String,
            clsEmpty: String,
            clsCustom: String,
            handle: String
        },

        defaults: {
            group: false,
            threshold: 5,
            clsItem: 'uk-sortable-item',
            clsPlaceholder: 'uk-sortable-placeholder',
            clsDrag: 'uk-sortable-drag',
            clsDragState: 'uk-drag',
            clsBase: 'uk-sortable',
            clsNoDrag: 'uk-sortable-nodrag',
            clsEmpty: 'uk-sortable-empty',
            clsCustom: '',
            handle: false
        },

        init() {
            ['init', 'start', 'move', 'end'].forEach(key => {
                var fn = this[key];
                this[key] = e => {
                    this.scrollY = win.scrollY;
                    var {x, y} = getPos(e);
                    this.pos = {x, y};

                    fn(e);
                };
            });
        },

        events: {

            [pointerDown]: 'init'

        },

        update: {

            write() {

                if (this.clsEmpty) {
                    toggleClass(this.$el, this.clsEmpty, !this.$el.children.length);
                }

                if (!this.drag) {
                    return;
                }

                offset(this.drag, {top: this.pos.y + this.origin.top, left: this.pos.x + this.origin.left});

                var top = offset(this.drag).top,
                    bottom = top + this.drag.offsetHeight,
                    scroll;

                if (top > 0 && top < this.scrollY) {
                    scroll = this.scrollY - 5;
                } else if (bottom < height(doc) && bottom > height(win) + this.scrollY) {
                    scroll = this.scrollY + 5;
                }

                scroll && setTimeout(() => win.scrollTo(win.scrollX, scroll), 5);
            }

        },

        methods: {

            init(e) {

                var {target, button, defaultPrevented} = e,
                    placeholder = toNodes(this.$el.children).filter(el => within(target, el))[0];

                if (!placeholder
                    || isInput(e.target)
                    || this.handle && !within(target, this.handle)
                    || button > 0
                    || within(target, `.${this.clsNoDrag}`)
                    || defaultPrevented
                ) {
                    return;
                }

                e.preventDefault();

                this.touched = [this];
                this.placeholder = placeholder;
                this.origin = assign({target, index: index(placeholder)}, this.pos);

                on(docEl, pointerMove, this.move);
                on(docEl, pointerUp, this.end);
                on(win, 'scroll', this.scroll);

                if (!this.threshold) {
                    this.start(e);
                }

            },

            start(e) {

                this.drag = append(UIkit.container, this.placeholder.outerHTML.replace(/^<li/i, '<div').replace(/li>$/i, 'div>'));

                css(this.drag, assign({
                    boxSizing: 'border-box',
                    width: this.placeholder.offsetWidth,
                    height: this.placeholder.offsetHeight
                }, css(this.placeholder, ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'display'])));
                attr(this.drag, 'uk-no-boot', '');
                addClass(this.drag, this.clsDrag, this.clsCustom);

                height(this.drag.firstElementChild, height(this.placeholder.firstElementChild));
                // debugger;
                css(this.drag.firstElementChild, 'width', css(this.placeholder.firstElementChild, 'width'));

                var {left, top} = offset(this.placeholder);
                assign(this.origin, {left: left - this.pos.x, top: top - this.pos.y});

                addClass(this.placeholder, this.clsPlaceholder);
                addClass(this.$el.children, this.clsItem);
                addClass(docEl, this.clsDragState);

                trigger(this.$el, 'start', [this, this.placeholder, this.drag]);

                this.move(e);
            },

            move(e) {

                if (!this.drag) {

                    if (Math.abs(this.pos.x - this.origin.x) > this.threshold || Math.abs(this.pos.y - this.origin.y) > this.threshold) {
                        this.start(e);
                    }

                    return;
                }

                this.$emit();

                var target = e.type === 'mousemove' ? e.target : doc.elementFromPoint(this.pos.x - doc.body.scrollLeft, this.pos.y - doc.body.scrollTop),
                    sortable = getSortable(target),
                    previous = getSortable(this.placeholder),
                    move = sortable !== previous;

                if (!sortable || within(target, this.placeholder) || move && (!sortable.group || sortable.group !== previous.group)) {
                    return;
                }

                target = sortable.$el === target.parentNode && target || toNodes(sortable.$el.children).filter(element => within(target, element))[0];

                if (move) {
                    previous.remove(this.placeholder);
                } else if (!target) {
                    return;
                }

                sortable.insert(this.placeholder, target);

                if (!includes(this.touched, sortable)) {
                    this.touched.push(sortable);
                }

            },

            scroll() {
                var scroll = win.scrollY;
                if (scroll !== this.scrollY) {
                    this.pos.y += scroll - this.scrollY;
                    this.scrollY = scroll;
                    this.$emit();
                }
            },

            end(e) {

                off(docEl, pointerMove, this.move);
                off(docEl, pointerUp, this.end);
                off(win, 'scroll', this.scroll);

                if (!this.drag) {

                    if (e.type !== 'mouseup' && within(e.target, 'a[href]')) {
                        location.href = closest(e.target, 'a[href]').href;
                    }

                    return;
                }

                preventClick();

                var sortable = getSortable(this.placeholder);

                if (this === sortable) {
                    if (this.origin.index !== index(this.placeholder)) {
                        trigger(this.$el, 'moved', [this, this.placeholder]);
                    }
                } else {
                    trigger(sortable.$el, 'added', [sortable, this.placeholder]);
                    trigger(this.$el, 'removed', [this, this.placeholder]);
                }

                trigger(this.$el, 'stop', [this]);

                remove(this.drag);
                this.drag = null;

                var classes = this.touched.map(sortable => `${sortable.clsPlaceholder} ${sortable.clsItem}`).join(' ');
                this.touched.forEach(sortable => removeClass(sortable.$el.children, classes));

                removeClass(docEl, this.clsDragState);

            },

            insert(element, target) {

                addClass(this.$el.children, this.clsItem);

                var insert = () => {

                    if (target) {

                        if (!within(element, this.$el) || isPredecessor(element, target)) {
                            before(target, element);
                        } else {
                            after(target, element);
                        }

                    } else {
                        append(this.$el, element);
                    }

                };

                if (this.animation) {
                    this.animate(insert, this.animation);
                } else {
                    insert();
                }

            },

            remove(element) {

                if (!within(element, this.$el)) {
                    return;
                }

                if (this.animation) {
                    this.animate(() => remove(element), this.animation);
                } else {
                    remove(element);
                }

            },
        }

    });

    function getSortable(element) {
        return element && (UIkit.getComponent(element, 'sortable') || getSortable(element.parentNode));
    }

    function isPredecessor(element, target) {
        return element.parentNode === target.parentNode && index(element) > index(target);
    }

}

if (!BUNDLED && typeof window !== 'undefined' && window.UIkit) {
    window.UIkit.use(plugin);
}

export default plugin;
