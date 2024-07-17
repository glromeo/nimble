import {batch, computed, effect, Signal, signal, untracked} from "./signals.mjs";
import {expect, sinon} from "mocha-toolkit";

describe("signal", () => {
    it("should return value", () => {
        const v = [1, 2];
        const s = signal(v);
        expect(s.get()).to.equal(v);
    });

    it("should inherit from Signal", () => {
        expect(signal(0)).to.be.instanceOf(Signal);
    });

    it("should support .toString()", () => {
        const s = signal(123);
        expect(s.toString()).equal("123");
    });

    it("should support .toJSON()", () => {
        const s = signal(123);
        expect(s.toJSON()).equal(123);
    });

    it("should support JSON.Stringify()", () => {
        const s = signal(123);
        expect(JSON.stringify({s})).equal(JSON.stringify({s: 123}));
    });

    it("should support .valueOf()", () => {
        const s = signal(123);
        expect(s).to.have.property("valueOf");
        expect(s.valueOf).to.be.a("function");
        expect(s.valueOf()).equal(123);
        expect(+s).equal(123);

        const a = signal(1);
        const b = signal(2);
        // @ts-ignore-next-line
        expect(a + b).to.equal(3);
    });

    it("should notify other listeners of changes after one listener is disposed", () => {
        const s = signal(0);
        const spy1 = sinon.spy(() => {
            s.get();
        });
        const spy2 = sinon.spy(() => {
            s.get();
        });
        const spy3 = sinon.spy(() => {
            s.get();
        });

        effect(spy1);
        const dispose = effect(spy2);
        effect(spy3);

        expect(spy1).to.be.calledOnce;
        expect(spy2).to.be.calledOnce;
        expect(spy3).to.be.calledOnce;

        dispose();

        s.set(1);
        expect(spy1).to.be.calledTwice;
        expect(spy2).to.be.calledOnce;
        expect(spy3).to.be.calledTwice;
    });

    describe(".peek()", () => {
        it("should get value", () => {
            const s = signal(1);
            expect(s.peek()).equal(1);
        });

        it("should get the updated value after a value change", () => {
            const s = signal(1);
            s.set(2);
            expect(s.peek()).equal(2);
        });

        it("should not make surrounding effect depend on the signal", () => {
            const s = signal(1);
            const spy = sinon.spy(() => {
                s.peek();
            });

            effect(spy);
            expect(spy).to.be.calledOnce;

            s.set(2);
            expect(spy).to.be.calledOnce;
        });

        it("should not make surrounding computed depend on the signal", () => {
            const s = signal(1);
            const spy = sinon.spy(() => {
                s.peek();
            });
            const d = computed(spy);

            d.get();
            expect(spy).to.be.calledOnce;

            s.set(2);
            d.get();
            expect(spy).to.be.calledOnce;
        });
    });

    describe(".sub()", () => {
        it("should subscribe to a signal", () => {
            const spy = sinon.spy();
            const a = signal(1);

            a.sub(spy);
            expect(spy).to.be.calledWith(1);
        });

        it("should run the callback when the signal value changes", () => {
            const spy = sinon.spy();
            const a = signal(1);

            a.sub(spy);

            a.set(2);
            expect(spy).to.be.calledWith(2);
        });

        it("should unsubscribe from a signal", () => {
            const spy = sinon.spy();
            const a = signal(1);

            const dispose = a.sub(spy);
            dispose();
            spy.resetHistory();

            a.set(2);
            expect(spy).not.to.be.called;
        });

        it("should not start triggering on when a signal accessed in the callback changes", () => {
            const spy = sinon.spy();
            const a = signal(0);
            const b = signal(0);

            a.sub(() => {
                b.get();
                spy();
            });
            expect(spy).to.be.calledOnce;
            spy.resetHistory();

            b.set(b.get() + 1);
            expect(spy).not.to.be.called;
        });

        it("should not cause surrounding effect to subscribe to changes to a signal accessed in the callback", () => {
            const spy = sinon.spy();
            const a = signal(0);
            const b = signal(0);

            effect(() => {
                a.sub(() => {
                    b.get();
                });
                spy();
            });
            expect(spy).to.be.calledOnce;
            spy.resetHistory();

            b.set(b.get() + 1);
            expect(spy).not.to.be.called;
        });
    });
});

describe("effect()", () => {
    it("should run the callback immediately", () => {
        const s = signal(123);
        const spy = sinon.spy(() => {
            s.get();
        });
        effect(spy);
        expect(spy).to.be.called;
    });

    it("should subscribe to signals", () => {
        const s = signal(123);
        const spy = sinon.spy(() => {
            s.get();
        });
        effect(spy);
        spy.resetHistory();

        s.set(42);
        expect(spy).to.be.called;
    });

    it("should subscribe to multiple signals", () => {
        const a = signal("a");
        const b = signal("b");
        const spy = sinon.spy(() => {
            a.get();
            b.get();
        });
        effect(spy);
        spy.resetHistory();

        a.set("aa");
        b.set("bb");
        expect(spy).to.be.calledTwice;
    });

    it("should dispose of subscriptions", () => {
        const a = signal("a");
        const b = signal("b");
        const spy = sinon.spy(() => {
            a.get() + " " + b.get();
        });
        const dispose = effect(spy);
        spy.resetHistory();

        dispose();
        expect(spy).not.to.be.called;

        a.set("aa");
        b.set("bb");
        expect(spy).not.to.be.called;
    });

    it("should unsubscribe from signal", () => {
        const s = signal(123);
        const spy = sinon.spy(() => {
            s.get();
        });
        const unsub = effect(spy);
        spy.resetHistory();

        unsub();
        s.set(42);
        expect(spy).not.to.be.called;
    });

    it("should conditionally unsubscribe from signals", () => {
        const a = signal("a");
        const b = signal("b");
        const cond = signal(true);

        const spy = sinon.spy(() => {
            cond.get() ? a.get() : b.get();
        });

        effect(spy);
        expect(spy).to.be.calledOnce;

        b.set("bb");
        expect(spy).to.be.calledOnce;

        cond.set(false);
        expect(spy).to.be.calledTwice;

        spy.resetHistory();

        a.set("aaa");
        expect(spy).not.to.be.called;
    });

    it("should batch writes", () => {
        const a = signal("a");
        const spy = sinon.spy(() => {
            a.get();
        });
        effect(spy);
        spy.resetHistory();

        effect(() => {
            a.set("aa");
            a.set("aaa");
        });

        expect(spy).to.be.calledOnce;
    });

    it("should call the cleanup callback before the next run", () => {
        const a = signal(0);
        const spy = sinon.spy();

        effect(() => {
            a.get();
            return spy;
        });
        expect(spy).not.to.be.called;
        a.set(1);
        expect(spy).to.be.calledOnce;
        a.set(2);
        expect(spy).to.be.calledTwice;
    });

    it("should call only the callback from the previous run", () => {
        const spy1 = sinon.spy();
        const spy2 = sinon.spy();
        const spy3 = sinon.spy();
        const a = signal(spy1);

        effect(() => {
            return a.get();
        });

        expect(spy1).not.to.be.called;
        expect(spy2).not.to.be.called;
        expect(spy3).not.to.be.called;

        a.set(spy2);
        expect(spy1).to.be.calledOnce;
        expect(spy2).not.to.be.called;
        expect(spy3).not.to.be.called;

        a.set(spy3);
        expect(spy1).to.be.calledOnce;
        expect(spy2).to.be.calledOnce;
        expect(spy3).not.to.be.called;
    });

    it("should call the cleanup callback function when disposed", () => {
        const spy = sinon.spy();

        const dispose = effect(() => {
            return spy;
        });
        expect(spy).not.to.be.called;
        dispose();
        expect(spy).to.be.calledOnce;
    });

    it("should not recompute if the effect has been notified about changes, but no direct dependency has actually changed", () => {
        const s = signal(0);
        const c = computed(() => {
            s.get();
            return 0;
        });
        const spy = sinon.spy(() => {
            c.get();
        });
        effect(spy);
        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        s.set(1);
        expect(spy).not.to.be.called;
    });

    it("should not recompute dependencies unnecessarily", () => {
        const spy = sinon.spy();
        const a = signal(0).as("a");
        const b = signal(0).as("b");
        const c = computed(() => {
            b.get();
            spy();
        }).as("c");
        effect(() => {
            if (a.get() === 0) {
                c.get();
            }
        });
        expect(spy).to.be.calledOnce;

        batch(() => {
            b.set(1);
            a.set(1);
        });
        expect(spy).to.be.calledOnce;
    });

    it("should not recompute dependencies out of order", () => {
        const a = signal(1).as("a");
        const b = signal(1).as("b");
        const c = signal(1).as("c");

        const spy = sinon.spy(() => c.get());
        const d = computed(spy).as("d");

        effect(() => {
            if (a.get() > 0) {
                b.get();
                d.get();
            } else {
                b.get();
            }
        });
        spy.resetHistory();

        batch(() => {
            a.set(2);
            b.set(2);
            c.set(2);
        });
        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        batch(() => {
            a.set(-1);
            b.set(-1);
            c.set(-1);
        });
        expect(spy).not.to.be.called;
        spy.resetHistory();
    });

    it("should recompute if a dependency changes during computation after becoming a dependency", () => {
        const a = signal(0);
        const spy = sinon.spy(() => {
            if (a.get() === 0) {
                a.set(a.get() + 1);
            }
        });
        effect(spy);
        expect(spy).to.be.calledTwice;
    });

    it("should run the cleanup in an implicit batch", () => {
        const a = signal(0);
        const b = signal("a");
        const c = signal("b");
        const spy = sinon.spy();

        effect(() => {
            b.get();
            c.get();
            spy(b.get() + c.get());
        });

        effect(() => {
            a.get();
            return () => {
                b.set("x");
                c.set("y");
            };
        });

        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        a.set(1);
        expect(spy).to.be.calledOnce;
        expect(spy).to.be.calledWith("xy");
    });

    it("should not retrigger the effect if the cleanup modifies one of the dependencies", () => {
        const a = signal(0);
        const spy = sinon.spy();

        effect(() => {
            spy(a.get());
            return () => {
                a.set(2);
            };
        });
        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        a.set(1);
        expect(spy).to.be.calledOnce;
        expect(spy).to.be.calledWith(2);
    });

    it("should run the cleanup if the effect disposes itself", () => {
        const a = signal(0);
        const spy = sinon.spy();

        const dispose = effect(() => {
            if (a.get() > 0) {
                dispose();
                return spy;
            }
        });
        expect(spy).not.to.be.called;
        a.set(1);
        expect(spy).to.be.calledOnce;
        a.set(2);
        expect(spy).to.be.calledOnce;
    });

    it("should not run the effect if the cleanup function disposes it", () => {
        const a = signal(0);
        const spy = sinon.spy();

        const dispose = effect(() => {
            a.get();
            spy();
            return () => {
                dispose();
            };
        });
        expect(spy).to.be.calledOnce;
        a.set(1);
        expect(spy).to.be.calledOnce;
    });

    it("should not subscribe to anything if first run throws", () => {
        const s = signal(0);
        const spy = sinon.spy(() => {
            s.get();
            throw new Error("test");
        });
        expect(() => effect(spy)).to.throw("test");
        expect(spy).to.be.calledOnce;

        s.set(s.get() + 1);
        expect(spy).to.be.calledOnce;
    });

    it("should reset the cleanup if the effect throws", () => {
        const a = signal(0);
        const spy = sinon.spy();

        effect(() => {
            if (a.get() === 0) {
                return spy;
            } else {
                throw new Error("hello");
            }
        });
        expect(spy).not.to.be.called;
        expect(() => a.set(1)).to.throw("hello");
        expect(spy).to.be.calledOnce;
        a.set(0);
        expect(spy).to.be.calledOnce;
    });

    it("should dispose the effect if the cleanup callback throws", () => {
        const a = signal(0);
        const spy = sinon.spy();

        effect(() => {
            if (a.get() === 0) {
                return () => {
                    throw new Error("hello");
                };
            } else {
                spy();
            }
        });
        expect(spy).not.to.be.called;
        expect(() => a.set(a.get() + 1)).to.throw("hello");
        expect(spy).not.to.be.called;
        a.set(a.get() + 1);
        expect(spy).not.to.be.called;
    });

    it("should run cleanups outside any evaluation context", () => {
        const spy = sinon.spy();
        const a = signal(0);
        const b = signal(0);
        const c = computed(() => {
            if (a.get() === 0) {
                effect(() => {
                    return () => {
                        b.get();
                    };
                });
            }
            return a.get();
        });

        effect(() => {
            spy();
            c.get();
        });
        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        a.set(1);
        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        b.set(1);
        expect(spy).not.to.be.called;
    });

    it("should NOT throw on cycles", () => {
        const a = signal(0);
        let i = 0;

        const fn = () =>
            effect(() => {
                // Prevent test suite from spinning if limit is not hit
                if (i++ > 200) {
                    throw new Error("test failed");
                }
                a.get();
                a.set(NaN);
            });

        expect(fn).not.to.throw();
        expect(a.peek()).to.be.NaN;
    });

    it("should NOT throw on indirect cycles", () => {
        const a = signal(0);
        let i = 0;

        const c = computed(() => {
            a.get();
            a.set(NaN);
            return NaN;
        });

        const fn = () =>
            effect(() => {
                // Prevent test suite from spinning if limit is not hit
                if (i++ > 200) {
                    throw new Error("test failed");
                }
                c.get();
            });

        expect(fn).to.not.throw();
        expect(a.peek()).to.be.NaN;
    });

    it("should allow disposing the effect multiple times", () => {
        const dispose = effect(() => undefined);
        dispose();
        expect(() => dispose()).not.to.throw();
    });

    it("should allow disposing a running effect", () => {
        const a = signal(0);
        const spy = sinon.spy();
        const dispose = effect(() => {
            if (a.get() === 1) {
                dispose();
                spy();
            }
        });
        expect(spy).not.to.be.called;
        a.set(1);
        expect(spy).to.be.calledOnce;
        a.set(2);
        expect(spy).to.be.calledOnce;
    });

    it("should not run if it's first been triggered and then disposed in a batch", () => {
        const a = signal(0);
        const spy = sinon.spy(() => {
            a.get();
        });
        const dispose = effect(spy);
        spy.resetHistory();

        batch(() => {
            a.set(1);
            dispose();
        });

        expect(spy).not.to.be.called;
    });

    it("should not run if it's been triggered, disposed and then triggered again in a batch", () => {
        const a = signal(0);
        const spy = sinon.spy(() => {
            a.get();
        });
        const dispose = effect(spy);
        spy.resetHistory();

        batch(() => {
            a.set(1);
            dispose();
            a.set(2);
        });

        expect(spy).not.to.be.called;
    });

    it("should not rerun parent effect if a nested child effect's signal's value changes", () => {
        const parentSignal = signal(0);
        const childSignal = signal(0);

        const parentEffect = sinon.spy(() => {
            parentSignal.get();
        });
        const childEffect = sinon.spy(() => {
            childSignal.get();
        });

        effect(() => {
            parentEffect();
            effect(childEffect);
        });

        expect(parentEffect).to.be.calledOnce;
        expect(childEffect).to.be.calledOnce;

        childSignal.set(1);

        expect(parentEffect).to.be.calledOnce;
        expect(childEffect).to.be.calledTwice;

        parentSignal.set(1);

        expect(parentEffect).to.be.calledTwice;
        expect(childEffect).to.be.calledThrice;
    });

});

describe("computed()", () => {
    it("should return value", () => {
        const a = signal("a");
        const b = signal("b");

        const c = computed(() => a.get() + b.get());
        expect(c.get()).to.equal("ab");
    });

    it("should inherit from Signal", () => {
        expect(computed(() => 0)).to.be.instanceOf(Signal);
    });

    it("should return updated value", () => {
        const a = signal("a");
        const b = signal("b");

        const c = computed(() => a.get() + b.get());
        expect(c.get()).to.equal("ab");

        a.set("aa");
        expect(c.get()).to.equal("aab");
    });

    it("should be lazily computed on demand", () => {
        const a = signal("a");
        const b = signal("b");
        const spy = sinon.spy(() => a.get() + b.get());
        const c = computed(spy);
        expect(spy).to.not.be.called;
        c.get();
        expect(spy).to.be.calledOnce;
        a.set("x");
        b.set("y");
        expect(spy).to.be.calledOnce;
        c.get();
        expect(spy).to.be.calledTwice;
    });

    it("should be computed only when a dependency has changed at some point", () => {
        const a = signal("a");
        const spy = sinon.spy(() => {
            return a.get();
        });
        const c = computed(spy);
        c.get();
        expect(spy).to.be.calledOnce;
        a.set("a");
        c.get();
        expect(spy).to.be.calledOnce;
    });

    it("should recompute if a dependency changes during computation after becoming a dependency", () => {
        const a = signal(0);
        const spy = sinon.spy(() => {
            a.set(a.get() + 1);
        });
        const c = computed(spy);
        c.get();
        expect(spy).to.be.calledOnce;
        c.get();
        expect(spy).to.be.calledTwice;
    });

    it("should detect simple dependency cycles and resort to undefined", () => {
        let i = 0;
        const a = computed(() => {
            if (++i > 200) {
                throw new Error("test failed");
            }
            return a.get();
        });
        expect(() => a.get()).not.to.throw();
        expect(a.get()).to.be.undefined;
    });

    it("should detect deep dependency cycles", () => {
        const a = computed(() => b.get());
        const b = computed(() => c.get());
        const c = computed(() => d.get());
        let i = 0;
        const d = computed(() => {
            if (++i > 200) {
                throw new Error("test failed");
            }
            return a.get();
        });
        expect(() => a.get()).not.to.throw();
        expect(a.get()).to.be.undefined;
    });

    it("should not allow a computed signal to become a direct dependency of itself", () => {
        const spy = sinon.spy(() => {
            try {
                a.get();
            } catch {
                // pass
            }
        });
        const a = computed(spy);
        a.get();
        expect(() => effect(() => a.get())).to.not.throw();
    });

    it("should store thrown errors and recompute only after a dependency changes", () => {
        const a = signal(0);
        const spy = sinon.spy(() => {
            a.get();
            throw new Error();
        });
        const c = computed(spy);
        expect(() => c.get()).to.throw();
        expect(() => c.get()).to.throw();
        expect(spy).to.be.calledOnce;
        a.set(1);
        expect(() => c.get()).to.throw();
        expect(spy).to.be.calledTwice;
    });

    it("should store thrown non-errors and recompute only after a dependency changes", () => {
        const a = signal(0);
        const spy = sinon.spy();
        const c = computed(() => {
            a.get();
            spy();
            throw undefined;
        });

        try {
            c.get();
            expect.fail();
        } catch (err) {
            expect(err).to.be.undefined;
        }
        try {
            c.get();
            expect.fail();
        } catch (err) {
            expect(err).to.be.undefined;
        }
        expect(spy).to.be.calledOnce;

        a.set(1);
        try {
            c.get();
            expect.fail();
        } catch (err) {
            expect(err).to.be.undefined;
        }
        expect(spy).to.be.calledTwice;
    });

    it("should conditionally unsubscribe from signals", () => {
        const a = signal("a");
        const b = signal("b");
        const cond = signal(true);

        const spy = sinon.spy(() => {
            return cond.get() ? a.get() : b.get();
        });

        const c = computed(spy);
        expect(c.get()).to.equal("a");
        expect(spy).to.be.calledOnce;

        b.set("bb");
        expect(c.get()).to.equal("a");
        expect(spy).to.be.calledOnce;

        cond.set(false);
        expect(c.get()).to.equal("bb");
        expect(spy).to.be.calledTwice;

        spy.resetHistory();

        a.set("aaa");
        expect(c.get()).to.equal("bb");
        expect(spy).not.to.be.called;
    });

    it("should consider undefined value separate from uninitialized value", () => {
        const a = signal(0);
        const spy = sinon.spy(() => undefined);
        const c = computed(spy);

        expect(c.get()).to.be.undefined;
        a.set(1);
        expect(c.get()).to.be.undefined;
        expect(spy).to.be.calledOnce;
    });

    it("should not leak errors raised by dependencies", () => {
        const a = signal(0);
        const b = computed(() => {
            a.get();
            throw new Error("error");
        });
        const c = computed(() => {
            try {
                b.get();
            } catch {
                return "ok";
            }
        });
        expect(c.get()).to.equal("ok");
        a.set(1);
        expect(c.get()).to.equal("ok");
    });

    it("should propagate notifications even right after first subscription", () => {
        const a = signal(0);
        const b = computed(() => a.get());
        const c = computed(() => b.get());
        c.get();

        const spy = sinon.spy(() => {
            c.get();
        });

        effect(spy);
        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        a.set(1);
        expect(spy).to.be.calledOnce;
    });

    it("should get marked as outdated right after first subscription", () => {
        const s = signal(0);
        const c = computed(() => s.get());
        c.get();

        s.set(1);
        effect(() => {
            c.get();
        });
        expect(c.get()).to.equal(1);
    });

    it("should propagate notification to other listeners after one listener is disposed", () => {
        const s = signal(0);
        const c = computed(() => s.get());

        const spy1 = sinon.spy(() => {
            c.get();
        });
        const spy2 = sinon.spy(() => {
            c.get();
        });
        const spy3 = sinon.spy(() => {
            c.get();
        });

        effect(spy1);
        const dispose = effect(spy2);
        effect(spy3);

        expect(spy1).to.be.calledOnce;
        expect(spy2).to.be.calledOnce;
        expect(spy3).to.be.calledOnce;

        dispose();

        s.set(1);
        expect(spy1).to.be.calledTwice;
        expect(spy2).to.be.calledOnce;
        expect(spy3).to.be.calledTwice;
    });

    it("should not recompute dependencies out of order", () => {
        const a = signal(1);
        const b = signal(1);
        const c = signal(1);

        const spy = sinon.spy(() => c.get());
        const d = computed(spy);

        const e = computed(() => {
            if (a.get() > 0) {
                b.get();
                d.get();
            } else {
                b.get();
            }
        });

        e.get();
        spy.resetHistory();

        a.set(2);
        b.set(2);
        c.set(2);
        e.get();
        expect(spy).to.be.calledOnce;
        spy.resetHistory();

        a.set(-1);
        b.set(-1);
        c.set(-1);
        e.get();
        expect(spy).not.to.be.called;
        spy.resetHistory();
    });

    it("should not recompute dependencies unnecessarily", () => {
        const spy = sinon.spy();
        const a = signal(0);
        const b = signal(0);
        const c = computed(() => {
            b.get();
            spy();
        });
        const d = computed(() => {
            if (a.get() === 0) {
                c.get();
            }
        });
        d.get();
        expect(spy).to.be.calledOnce;

        batch(() => {
            b.set(1);
            a.set(1);
        });
        d.get();
        expect(spy).to.be.calledOnce;
    });

    describe(".peek()", () => {
        it("should get value", () => {
            const s = signal(1);
            const c = computed(() => s.get());
            expect(c.peek()).equal(1);
        });

        it("should throw when evaluation throws", () => {
            const c = computed(() => {
                throw Error("test");
            });
            expect(() => c.peek()).to.throw("test");
        });

        it("should throw when previous evaluation threw and dependencies haven't changed", () => {
            const c = computed(() => {
                throw Error("test");
            });
            expect(() => c.get()).to.throw("test");
            expect(() => c.peek()).to.throw("test");
        });

        it("should refresh value if stale", () => {
            const a = signal(1);
            const b = computed(() => a.get());
            expect(b.peek()).to.equal(1);

            a.set(2);
            expect(b.peek()).to.equal(2);
        });

        it("should detect simple dependency cycles", () => {
            let i = 0;
            const a = computed(() => {
                if (++i > 200) {
                    throw new Error("test failed");
                }
                return a.peek();
            });
            expect(() => a.peek()).not.to.throw();
            expect(a.peek()).to.be.undefined;
        });

        it("should detect deep dependency cycles", () => {
            const a = computed(() => b.get());
            const b = computed(() => c.get());
            const c = computed(() => d.get());
            let i = 0;
            const d = computed(() => {
                if (++i > 200) {
                    throw new Error("test failed");
                }
                return a.peek();
            });
            expect(() => d.peek()).not.to.throw();
            expect(d.peek()).to.be.undefined;
        });

        it("should not make surrounding effect depend on the computed", () => {
            const s = signal(1);
            const c = computed(() => s.get());
            const spy = sinon.spy(() => {
                c.peek();
            });

            effect(spy);
            expect(spy).to.be.calledOnce;

            s.set(2);
            expect(spy).to.be.calledOnce;
        });

        it("should not make surrounding computed depend on the computed", () => {
            const s = signal(1);
            const c = computed(() => s.get());

            const spy = sinon.spy(() => {
                c.peek();
            });

            const d = computed(spy);
            d.get();
            expect(spy).to.be.calledOnce;

            s.set(2);
            d.get();
            expect(spy).to.be.calledOnce;
        });

        it("should not make surrounding effect depend on the peeked computed's dependencies", () => {
            const a = signal(1);
            const b = computed(() => a.get());
            const spy = sinon.spy();
            effect(() => {
                spy();
                b.peek();
            });
            expect(spy).to.be.calledOnce;
            spy.resetHistory();

            a.set(1);
            expect(spy).not.to.be.called;
        });

        it("should not make surrounding computed depend on peeked computed's dependencies", () => {
            const a = signal(1);
            const b = computed(() => a.get());
            const spy = sinon.spy();
            const d = computed(() => {
                spy();
                b.peek();
            });
            d.get();
            expect(spy).to.be.calledOnce;
            spy.resetHistory();

            a.set(1);
            d.get();
            expect(spy).not.to.be.called;
        });
    });

    describe("garbage collection", function () {
        before(function () {
            if (typeof gc === "undefined") {
                this.skip(); // Skip GC tests if window.gc/global.gc is not defined.
            }
        });

        it("should be garbage collectable if nothing is listening to its changes", async () => {
            const s = signal(0);
            const ref = new WeakRef(computed(() => s.get()));

            gc();
            await new Promise(resolve => setTimeout(resolve, 0));
            gc();
            expect(ref.deref()).to.be.undefined;
        });

        it("should be garbage collectable after it has lost all of its listeners", async () => {
            const s = signal(0);

            let ref;
            let dispose;

            (function () {
                const c = computed(() => s.get());
                ref = new WeakRef(c);
                dispose = effect(() => {
                    c.get();
                });
            })();

            dispose();
            gc();
            await new Promise(resolve => setTimeout(resolve, 0));
            gc();
            expect(ref.deref()).to.be.undefined;
        });
    });

    describe("graph updates", () => {
        it("should run computeds once for multiple dep changes", async () => {
            const a = signal("a");
            const b = signal("b");

            const compute = sinon.spy(() => {
                // debugger;
                return a.get() + b.get();
            });
            const c = computed(compute);

            expect(c.get()).to.equal("ab");
            expect(compute).to.have.been.calledOnce;
            compute.resetHistory();

            a.set("aa");
            b.set("bb");
            c.get();
            expect(compute).to.have.been.calledOnce;
        });

        it("should drop A->B->A updates", async () => {
            //     A
            //   / |
            //  B  | <- Looks like a flag doesn't it? :D
            //   \ |
            //     C
            //     |
            //     D
            const a = signal(2);

            const b = computed(() => a.get() - 1);
            const c = computed(() => a.get() + b.get());

            const compute = sinon.spy(() => "d: " + c.get());
            const d = computed(compute);

            // Trigger read
            expect(d.get()).to.equal("d: 3");
            expect(compute).to.have.been.calledOnce;
            compute.resetHistory();

            a.set(4);
            d.get();
            expect(compute).to.have.been.calledOnce;
        });

        it("should only update every signal once (diamond graph)", () => {
            // In this scenario "D" should only update once when "A" receives
            // an update. This is sometimes referred to as the "diamond" scenario.
            //     A
            //   /   \
            //  B     C
            //   \   /
            //     D
            const a = signal("a");
            const b = computed(() => a.get());
            const c = computed(() => a.get());

            const spy = sinon.spy(() => b.get() + " " + c.get());
            const d = computed(spy);

            expect(d.get()).to.equal("a a");
            expect(spy).to.be.calledOnce;

            a.set("aa");
            expect(d.get()).to.equal("aa aa");
            expect(spy).to.be.calledTwice;
        });

        it("should only update every signal once (diamond graph + tail)", () => {
            // "E" will be likely updated twice if our mark+sweep logic is buggy.
            //     A
            //   /   \
            //  B     C
            //   \   /
            //     D
            //     |
            //     E
            const a = signal("a");
            const b = computed(() => a.get());
            const c = computed(() => a.get());

            const d = computed(() => b.get() + " " + c.get());

            const spy = sinon.spy(() => d.get());
            const e = computed(spy);

            expect(e.get()).to.equal("a a");
            expect(spy).to.be.calledOnce;

            a.set("aa");
            expect(e.get()).to.equal("aa aa");
            expect(spy).to.be.calledTwice;
        });

        it("should bail out if result is the same", () => {
            // Bail out if value of "B" never changes
            // A->B->C
            const a = signal("a");
            const b = computed(() => {
                a.get();
                return "foo";
            });

            const spy = sinon.spy(() => b.get());
            const c = computed(spy);

            expect(c.get()).to.equal("foo");
            expect(spy).to.be.calledOnce;

            a.set("aa");
            expect(c.get()).to.equal("foo");
            expect(spy).to.be.calledOnce;
        });

        it("should only update every signal once (jagged diamond graph + tails)", () => {
            // "F" and "G" will be likely updated twice if our mark+sweep logic is buggy.
            //     A
            //   /   \
            //  B     C
            //  |     |
            //  |     D
            //   \   /
            //     E
            //   /   \
            //  F     G
            const a = signal("a").as("A");

            const b = computed(() => a.get()).as("B");
            const c = computed(() => a.get()).as("C");

            const d = computed(() => c.get()).as("D");

            const eSpy = sinon.spy(() => b.get() + " " + d.get());
            const e = computed(eSpy).as("E");

            const fSpy = sinon.spy(() => e.get());
            const f = computed(fSpy).as("F");
            const gSpy = sinon.spy(() => e.get());
            const g = computed(gSpy).as("G");

            expect(f.get()).to.equal("a a");
            expect(fSpy).to.be.calledOnce;

            expect(g.get()).to.equal("a a");
            expect(gSpy).to.be.calledOnce;

            eSpy.resetHistory();
            fSpy.resetHistory();
            gSpy.resetHistory();

            a.set("b");

            expect(e.get()).to.equal("b b");
            expect(eSpy).to.be.calledOnce;

            expect(f.get()).to.equal("b b");
            expect(fSpy).to.be.calledOnce;

            expect(g.get()).to.equal("b b");
            expect(gSpy).to.be.calledOnce;

            eSpy.resetHistory();
            fSpy.resetHistory();
            gSpy.resetHistory();

            a.set("c");

            expect(e.get()).to.equal("c c");
            expect(eSpy).to.be.calledOnce;

            expect(f.get()).to.equal("c c");
            expect(fSpy).to.be.calledOnce;

            expect(g.get()).to.equal("c c");
            expect(gSpy).to.be.calledOnce;

            // top to bottom
            expect(eSpy).to.have.been.calledBefore(fSpy);
            // left to right
            expect(fSpy).to.have.been.calledBefore(gSpy);
        });

        it("should only subscribe to signals listened to", () => {
            //    *A
            //   /   \
            // *B     C <- we don't listen to C
            const a = signal("a");

            const b = computed(() => a.get());
            const spy = sinon.spy(() => a.get());
            computed(spy);

            expect(b.get()).to.equal("a");
            expect(spy).not.to.be.called;

            a.set("aa");
            expect(b.get()).to.equal("aa");
            expect(spy).not.to.be.called;
        });

        it("should only subscribe to signals listened to", () => {
            // Here both "B" and "C" are active in the beginning, but
            // "B" becomes inactive later. At that point it should
            // not receive any updates anymore.
            //    *A
            //   /   \
            // *B     D <- we don't listen to C
            //  |
            // *C
            const a = signal("a");
            const spyB = sinon.spy(() => a.get());
            const b = computed(spyB);

            const spyC = sinon.spy(() => b.get());
            const c = computed(spyC);

            const d = computed(() => a.get());

            let result = "";
            const unsub = effect(() => {
                result = c.get();
            });

            expect(result).to.equal("a");
            expect(d.get()).to.equal("a");

            spyB.resetHistory();
            spyC.resetHistory();
            unsub();

            a.set("aa");

            expect(spyB).not.to.be.called;
            expect(spyC).not.to.be.called;
            expect(d.get()).to.equal("aa");
        });

        it("should ensure subs update even if one dep unmarks it", () => {
            // In this scenario "C" always returns the same value. When "A"
            // changes, "B" will update, then "C" at which point its update
            // to "D" will be unmarked. But "D" must still update because
            // "B" marked it. If "D" isn't updated, then we have a bug.
            //     A
            //   /   \
            //  B     *C <- returns same value every time
            //   \   /
            //     D
            const a = signal("a");
            const b = computed(() => a.get());
            const c = computed(() => {
                a.get();
                return "c";
            });
            const spy = sinon.spy(() => b.get() + " " + c.get());
            const d = computed(spy);
            expect(d.get()).to.equal("a c");
            spy.resetHistory();

            a.set("aa");
            d.get();
            expect(spy).to.returned("aa c");
        });

        it("should ensure subs update even if two deps unmark it", () => {
            // In this scenario both "C" and "D" always return the same
            // value. But "E" must still update because "A"  marked it.
            // If "E" isn't updated, then we have a bug.
            //     A
            //   / | \
            //  B *C *D
            //   \ | /
            //     E
            const a = signal("a");
            const b = computed(() => a.get());
            const c = computed(() => {
                a.get();
                return "c";
            });
            const d = computed(() => {
                a.get();
                return "d";
            });
            const spy = sinon.spy(() => b.get() + " " + c.get() + " " + d.get());
            const e = computed(spy);
            expect(e.get()).to.equal("a c d");
            spy.resetHistory();

            a.set("aa");
            e.get();
            expect(spy).to.returned("aa c d");
        });
    });

    describe("error handling", () => {
        it("should throw when writing to computeds", () => {
            const a = signal("a");
            const b = computed(() => a.get());
            const fn = () => (b.set("aa"));
            expect(fn).to.throw(/Cannot write to a computed signal/);
        });

        it("should keep graph consistent on errors during activation", () => {
            const a = signal(0);
            const b = computed(() => {
                throw new Error("fail");
            });
            const c = computed(() => a.get());
            expect(() => b.get()).to.throw("fail");

            a.set(1);
            expect(c.get()).to.equal(1);
        });

        it("should keep graph consistent on errors in computeds", () => {
            const a = signal(0);
            const b = computed(() => {
                if (a.get() === 1) throw new Error("fail");
                return a.get();
            });
            const c = computed(() => b.get());
            expect(c.get()).to.equal(0);

            a.set(1);
            expect(() => b.get()).to.throw("fail");

            a.set(2);
            expect(c.get()).to.equal(2);
        });

        it("should support lazy branches", () => {
            const a = signal(0);
            const b = computed(() => a.get());
            const c = computed(() => (a.get() > 0 ? a.get() : b.get()));

            expect(c.get()).to.equal(0);
            a.set(1);
            expect(c.get()).to.equal(1);

            a.set(0);
            expect(c.get()).to.equal(0);
        });

        it("should not update a sub if all deps unmark it", () => {
            // In this scenario "B" and "C" always return the same value. When "A"
            // changes, "D" should not update.
            //     A
            //   /   \
            // *B     *C
            //   \   /
            //     D
            const a = signal("a");
            const b = computed(() => {
                a.get();
                return "b";
            });
            const c = computed(() => {
                a.get();
                return "c";
            });
            const spy = sinon.spy(() => b.get() + " " + c.get());
            const d = computed(spy);
            expect(d.get()).to.equal("b c");
            spy.resetHistory();

            a.set("aa");
            expect(spy).not.to.be.called;
        });
    });
});

describe("batch/transaction", () => {
    it("should return the value from the callback", () => {
        expect(batch(() => 1)).to.equal(1);
    });

    it("should throw errors thrown from the callback", () => {
        expect(() =>
            batch(() => {
                throw Error("hello");
            })
        ).to.throw("hello");
    });

    it("should throw non-errors thrown from the callback", () => {
        try {
            batch(() => {
                throw undefined;
            });
            expect.fail();
        } catch (err) {
            expect(err).to.be.undefined;
        }
    });

    it("should delay writes", () => {
        const a = signal("a");
        const b = signal("b");
        const spy = sinon.spy(() => {
            a.get() + " " + b.get();
        });
        effect(spy);
        spy.resetHistory();

        batch(() => {
            a.set("aa");
            b.set("bb");
        });

        expect(spy).to.be.calledOnce;
    });

    it("should delay writes until outermost batch is complete", () => {
        const a = signal("a");
        const b = signal("b");
        const spy = sinon.spy(() => {
            a.get() + ", " + b.get();
        });
        effect(spy);
        spy.resetHistory();

        batch(() => {
            batch(() => {
                a.set(a.get() + " inner");
                b.set(b.get() + " inner");
            });
            a.set(a.get() + " outer");
            b.set(b.get() + " outer");
        });

        // If the inner batch() would have flushed the update
        // this spy would've been called twice.
        expect(spy).to.be.calledOnce;
    });

    it("should read signals written to", () => {
        const a = signal("a");

        let result = "";
        batch(() => {
            a.set("aa");
            result = a.get();
        });

        expect(result).to.equal("aa");
    });

    it("should read computed signals with updated source signals", () => {
        // A->B->C->D->E
        const a = signal("a");
        const b = computed(() => a.get());

        const spyC = sinon.spy(() => b.get());
        const c = computed(spyC);

        const spyD = sinon.spy(() => c.get());
        const d = computed(spyD);

        const spyE = sinon.spy(() => d.get());
        const e = computed(spyE);

        spyC.resetHistory();
        spyD.resetHistory();
        spyE.resetHistory();

        let result = "";
        batch(() => {
            a.set("aa");
            result = c.get();

            // Since "D" isn't accessed during batching, we should not
            // update it, only after batching has completed
            expect(spyD).not.to.be.called;
        });

        expect(result).to.equal("aa");
        expect(d.get()).to.equal("aa");
        expect(e.get()).to.equal("aa");
        expect(spyC).to.be.calledOnce;
        expect(spyD).to.be.calledOnce;
        expect(spyE).to.be.calledOnce;
    });

    it("should not block writes after batching completed", () => {
        // If no further writes after batch() are possible, than we
        // didn't restore state properly. Most likely "pending" still
        // holds elements that are already processed.
        const a = signal("a").as("A");
        const b = signal("b").as("B");
        const c = signal("c").as("C");
        const d = computed(() => a.get() + " " + b.get() + " " + c.get()).as("D");

        let result;
        effect(() => {
            result = d.get();
        });

        batch(() => {
            a.set("aa");
            b.set("bb");
        });
        c.set("cc");
        expect(result).to.equal("aa bb cc");
    });

    it("should not lead to stale signals with .get() in batch", () => {
        const invokes = [];
        const counter = signal(0);
        const double = computed(() => counter.get() * 2);
        const triple = computed(() => counter.get() * 3);

        effect(() => {
            invokes.push([double.get(), triple.get()]);
        });

        expect(invokes).to.deep.equal([[0, 0]]);

        batch(() => {
            counter.set(1);
            expect(double.get()).to.equal(2);
        });

        expect(invokes[1]).to.deep.equal([2, 3]);
    });

    it("should not lead to stale signals with state in batch", () => {
        const invokes = [];
        const counter = signal(0);
        const double = computed(() => counter.get() * 2);
        const triple = computed(() => counter.get() * 3);

        effect(() => {
            invokes.push([double.get(), triple.get()]);
        });

        expect(invokes).to.deep.equal([[0, 0]]);

        batch(() => {
            counter.set(1);
            expect(double.peek()).to.equal(2);
        });

        expect(invokes[1]).to.deep.equal([2, 3]);
    });

    it("should run pending effects even if the callback throws", () => {
        const a = signal(0);
        const b = signal(1);
        const spy1 = sinon.spy(() => {
            a.get();
        });
        const spy2 = sinon.spy(() => {
            b.get();
        });
        effect(spy1);
        effect(spy2);
        spy1.resetHistory();
        spy2.resetHistory();

        expect(() =>
            batch(() => {
                a.set(a.get() + 1);
                b.set(b.get() + 1);
                throw Error("hello");
            })
        ).to.throw("hello");

        expect(spy1).to.be.calledOnce;
        expect(spy2).to.be.calledOnce;
    });

    it("should run pending effects even if some effects throw", () => {
        const a = signal(0);
        const spy1 = sinon.spy(() => {
            a.get();
        });
        const spy2 = sinon.spy(() => {
            a.get();
        });
        effect(() => {
            if (a.get() === 1) {
                throw new Error("hello");
            }
        });
        effect(spy1);
        effect(() => {
            if (a.get() === 1) {
                throw new Error("hello");
            }
        });
        effect(spy2);
        effect(() => {
            if (a.get() === 1) {
                throw new Error("hello");
            }
        });
        spy1.resetHistory();
        spy2.resetHistory();

        expect(() =>
            batch(() => {
                a.set(a.get() + 1);
            })
        ).to.throw("hello");

        expect(spy1).to.be.calledOnce;
        expect(spy2).to.be.calledOnce;
    });

    it("should run effect's first run immediately even inside a batch", () => {
        let callCount = 0;
        const spy = sinon.spy();
        batch(() => {
            effect(spy);
            callCount = spy.callCount;
        });
        expect(callCount).to.equal(1);
    });
});

describe("untracked", () => {
    it("should block tracking inside effects", () => {
        const a = signal(1);
        const b = signal(2);
        const spy = sinon.spy(() => {
            a.get() + b.get();
        });
        effect(() => untracked(spy));
        expect(spy).to.be.calledOnce;

        a.set(10);
        b.set(20);
        expect(spy).to.be.calledOnce;
    });

    it("should block tracking even when run inside effect run inside untracked", () => {
        const s = signal(1);
        const spy = sinon.spy(() => s.get());

        untracked(() =>
            effect(() => {
                untracked(spy);
            })
        );
        expect(spy).to.be.calledOnce;

        s.set(2);
        expect(spy).to.be.calledOnce;
    });

    it("should not cause signal assignments throw", () => {
        const a = signal(1);
        const aChangedTime = signal(0);

        const dispose = effect(() => {
            a.get();
            untracked(() => {
                aChangedTime.set(aChangedTime.get() + 1);
            });
        });

        expect(() => a.set(2)).not.to.throw();
        expect(aChangedTime.get()).to.equal(2);
        a.set(3);
        expect(aChangedTime.get()).to.equal(3);

        dispose();
    });

    it("should block tracking inside computed signals", () => {
        const a = signal(1);
        const b = signal(2);
        const spy = sinon.spy(() => a.get() + b.get());
        const c = computed(() => untracked(spy));

        expect(spy).to.not.be.called;
        expect(c.get()).to.equal(3);
        a.set(10);
        c.get();
        b.set(20);
        c.get();
        expect(spy).to.be.calledOnce;
        expect(c.get()).to.equal(3);
    });
});
