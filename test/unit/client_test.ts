import Client = require('../../src/client');
import { expect } from './sinon_chai';


describe('Client', () => {
    let reporter, client: Client;
    let err = new Error('test');

    beforeEach(() => {
        reporter = sinon.spy((_, __, promise) => {
            promise.resolve({id: 1});
        });
        client = new Client({reporter: reporter});
    });

    describe('filter', () => {
        it('returns null to ignore notice', () => {
            let filter = sinon.spy((_) => null);
            client.addFilter(filter);

            client.notify({});

            expect(filter).to.have.been.called;
            expect(reporter).not.to.have.been.called;
        });

        it('returns true to keep notice', () => {
            let filter = sinon.spy((_) => true);
            client.addFilter(filter);

            client.notify({});

            expect(filter).to.have.been.called;
            expect(reporter).to.have.been.called;
        });

        it('returns notice to change payload', () => {
            let filter = sinon.spy((notice) => {
                notice.context.environment = 'production';
                return notice;
            });
            client.addFilter(filter);

            client.notify({});

            expect(filter).to.have.been.called;
            let notice = reporter.lastCall.args[0];
            expect(notice.context.environment).to.equal('production');
        });

        it('returns new notice to change payload', () => {
            let newNotice = {errors: []};
            let filter = sinon.spy((_) => {
                return newNotice;
            });
            client.addFilter(filter);

            client.notify({});

            expect(filter).to.have.been.called;
            let notice = reporter.lastCall.args[0];
            expect(notice).to.equal(newNotice);
        });
    });

    it('text error is reported', () => {
        client.notify('hello');

        expect(reporter).to.have.been.called;
        let notice = reporter.lastCall.args[0];
        let err = notice.errors[0];
        expect(err.message).to.equal('hello');
        expect(err.backtrace.length).to.equal(15);
    });

    it('"Script error" message is ignored', () => {
        client.notify('Script error');

        expect(reporter).not.to.have.been.called;
    });

    it('"InvalidAccessError" message is ignored', () => {
        client.notify('InvalidAccessError');

        expect(reporter).not.to.have.been.called;
    });

    context('"Uncaught ..." error message', () => {
        beforeEach(() => {
            let msg = 'Uncaught SecurityError: Blocked a frame with origin "https://airbrake.io" from accessing a cross-origin frame.';
            client.notify({type: '', message: msg});
        });

        it('splitted into type and message', () => {
            expect(reporter).to.have.been.called;
            let notice = reporter.lastCall.args[0];
            let err = notice.errors[0];
            expect(err.type).to.equal('SecurityError');
            expect(err.message).to.equal('Blocked a frame with origin "https://airbrake.io" from accessing a cross-origin frame.');
        });
    });

    describe('Angular error message', () => {
        beforeEach(() => {
            let msg = `[$injector:undef] Provider '$exceptionHandler' must return a value from $get factory method.\nhttp://errors.angularjs.org/1.4.3/$injector/undef?p0=%24exceptionHandler`;
            client.notify({type: 'Error', message: msg});
        });

        it('splitted into type and message', () => {
            expect(reporter).to.have.been.called;
            let notice = reporter.lastCall.args[0];
            let err = notice.errors[0];
            expect(err.type).to.equal('$injector:undef');
            expect(err.message).to.equal(`Provider '$exceptionHandler' must return a value from $get factory method.\nhttp://errors.angularjs.org/1.4.3/$injector/undef?p0=%24exceptionHandler`);
        });
    });

    describe('notify', () => {
        it('returns promise and resolves it', () => {
            let promise = client.notify(err);
            let onResolved = sinon.spy();
            promise.then(onResolved);
            expect(onResolved).to.have.been.called;
        });

        it('calls reporter', () => {
            client.notify(err);
            expect(reporter).to.have.been.called;
        });

        it('ignores falsey error', () => {
            let promise = client.notify('');
            expect(reporter).not.to.have.been.called;

            let spy = sinon.spy();
            promise.catch(spy);
            expect(spy).to.have.been.called;

            let err = spy.lastCall.args[0];
            expect(err.toString()).to.equal('Error: notify: got err="", wanted an Error');
        });

        it('reporter is called with valid options', () => {
            client.setProject('faultline-js', '123', 'https://api.example.com/v0');
            client.notify(err);

            expect(reporter).to.have.been.called;
            let opts = reporter.lastCall.args[1];
            expect(opts.project).to.equal('faultline-js');
            expect(opts.apiKey).to.equal('123');
            expect(opts.endpoint).to.equal('https://api.example.com/v0');
            expect(opts.timeout).to.equal(10000);
        });

        describe('custom data in the filter', () => {
            it('reports context', () => {
                client.addFilter((n) => {
                    n.context.context_key = '[custom_context]';
                    return n;
                });
                client.notify(err);

                let reported = reporter.lastCall.args[0];
                expect(reported.context.context_key).to.equal('[custom_context]');
            });

            it('reports environment', () => {
                client.addFilter((n) => {
                    n.environment.env_key = '[custom_env]';
                    return n;
                });
                client.notify(err);

                let reported = reporter.lastCall.args[0];
                expect(reported.environment.env_key).to.equal('[custom_env]');
            });

            it('reports params', () => {
                client.addFilter((n) => {
                    n.params.params_key = '[custom_params]';
                    return n;
                });
                client.notify(err);

                let reported = reporter.lastCall.args[0];
                expect(reported.params.params_key).to.equal('[custom_params]');
            });

            it('reports session', () => {
                client.addFilter((n) => {
                    n.session.session_key = '[custom_session]';
                    return n;
                });
                client.notify(err);

                let reported = reporter.lastCall.args[0];
                expect(reported.session.session_key).to.equal('[custom_session]');
            });
        });

        describe('wrapped error', () => {
            it('unwraps and processes error', () => {
                client.notify({error: err});
                expect(reporter).to.have.been.called;
            });

            it('ignores falsey error', () => {
                let promise = client.notify({error: null, params: {foo: 'bar'}});

                expect(reporter).not.to.have.been.called;

                let spy = sinon.spy();
                promise.catch(spy);
                expect(spy).to.have.been.called;

                let err = spy.lastCall.args[0];
                expect(err.toString()).to.equal('Error: notify: got err=null, wanted an Error');
            });

            it('reports custom context', () => {
                client.addFilter((n) => {
                    n.context.context1 = 'value1';
                    n.context.context2 = 'value2';
                    return n;
                });

                client.notify({
                    error: err,
                    context: {
                        context1: 'notify_value1',
                        context3: 'notify_value3',
                    },
                });

                let reported = reporter.lastCall.args[0];
                expect(reported.context.context1).to.equal('value1');
                expect(reported.context.context2).to.equal('value2');
                expect(reported.context.context3).to.equal('notify_value3');
            });

            it('reports custom environment', () => {
                client.addFilter((n) => {
                    n.environment.env1 = 'value1';
                    n.environment.env2 = 'value2';
                    return n;
                });

                client.notify({
                    error: err,
                    environment: {
                        env1: 'notify_value1',
                        env3: 'notify_value3',
                    },
                });

                let reported = reporter.lastCall.args[0];
                expect(reported.environment).to.deep.equal({
                    env1: 'value1',
                    env2: 'value2',
                    env3: 'notify_value3',
                });
            });

            it('reports custom params', () => {
                client.addFilter((n) => {
                    n.params.param1 = 'value1';
                    n.params.param2 = 'value2';
                    return n;
                });

                client.notify({
                    error: err,
                    params: {
                        param1: 'notify_value1',
                        param3: 'notify_value3',
                    },
                });

               let params = reporter.lastCall.args[0].params;
               expect(params.param1).to.equal('value1');
               expect(params.param2).to.equal('value2');
               expect(params.param3).to.equal('notify_value3');
            });

            it('reports custom session', () => {
                client.addFilter((n) => {
                    n.session.session1 = 'value1';
                    n.session.session2 = 'value2';
                    return n;
                });

               client.notify({
                   error: err,
                   session: {
                       session1: 'notify_value1',
                       session3: 'notify_value3',
                   },
               });

               let reported = reporter.lastCall.args[0];
               expect(reported.session).to.deep.equal({
                   session1: 'value1',
                   session2: 'value2',
                   session3: 'notify_value3',
               });
            });
        });
    });

    describe('location', () => {
        let notice;

        beforeEach(() => {
            client.notify(err);
            expect(reporter).to.have.been.called;
            notice = reporter.lastCall.args[0];
        });

        it('reports context.url', () => {
            expect(notice.context.url).to.equal('http://localhost:9876/context.html');
        });

        it('reports context.rootDirectory', () => {
            expect(notice.context.rootDirectory).to.equal('http://localhost:9876');
        });
    });

    describe('custom reporter', () => {
        it('is called on error', () => {
            let custom_reporter = sinon.spy();
            client.addReporter(custom_reporter);
            client.notify(err);
            expect(custom_reporter).to.have.been.called;
        });
    });

    describe('wrap', () => {
        it('does not invoke function immediately', () => {
            let fn = sinon.spy();
            client.wrap(fn);
            expect(fn).not.to.have.been.called;
        });

        it('creates wrapper that invokes function with passed args', () => {
            let fn = sinon.spy();
            let wrapper: any = client.wrap(fn);
            wrapper('hello', 'world');
            expect(fn).to.have.been.called;
            expect(fn.lastCall.args).to.deep.equal(['hello', 'world']);
        });

        it('sets __airbrake and __inner properties', () => {
            let fn = sinon.spy();
            let wrapper = client.wrap(fn);
            expect(wrapper.__airbrake).to.equal(true);
            expect(wrapper.__inner).to.equal(fn);
        });

        it('copies function properties', () => {
            let fn = sinon.spy();
            (fn as any).prop = 'hello';
            let wrapper: any = client.wrap(fn);
            expect(wrapper.prop).to.equal('hello');
        });

        it('reports throwed exception', () => {
            let spy = sinon.spy();
            client.notify = spy;
            let fn = () => { throw err; };
            let wrapper: any = client.wrap(fn);
            try {
                wrapper('hello', 'world');
            } catch (err) {}

            expect(spy).to.have.been.called;
            expect(spy.lastCall.args).to.deep.equal([{
                error: err,
                params: {arguments: ['hello', 'world']},
            }]);
        });

        it('wraps arguments', () => {
            let fn = sinon.spy();
            let wrapper: any = client.wrap(fn);
            let arg1 = () => null;
            wrapper(arg1);

            expect(fn).to.have.been.called;
            let arg1Wrapper = fn.lastCall.args[0];
            expect(arg1Wrapper.__airbrake).to.equal(true);
            expect(arg1Wrapper.__inner).to.equal(arg1);
        });
    });

    describe('call', () => {
        it('reports throwed exception', () => {
            let spy = sinon.spy();
            client.notify = spy;
            let fn = () => { throw err; };
            try {
                client.call(fn, 'hello', 'world');
            } catch (_) {}

            expect(spy).to.have.been.called;
            expect(spy.lastCall.args).to.deep.equal([{
                error: err,
                params: {arguments: ['hello', 'world']},
            }]);
        });
    });

    describe('offline', () => {
        let spy;

        beforeEach(() => {
            let event = new Event('offline');
            window.dispatchEvent(event);

            let promise = client.notify(err);
            spy = sinon.spy();
            promise.then(spy);
        });

        it('causes client to not report errors', () => {
            expect(reporter).not.to.have.been.called;
        });

        describe('online', () => {
            beforeEach(() => {
                let event = new Event('online');
                window.dispatchEvent(event);
            });

            it('causes client to report queued errors', () => {
                expect(reporter).to.have.been.called;
            });

            it('resolves promise', () => {
                expect(spy).to.have.been.called;
            });
        });
    });
});
