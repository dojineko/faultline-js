import Promise from '../airbrake-js/src/promise';
import Notice from '../airbrake-js/src/notice';
import jsonifyNotice from '../jsonify_notice';

import {ReporterOptions} from './reporter';


export default function report(notice: Notice, opts: ReporterOptions, promise: Promise): void {
    let url = `${opts.endpoint}/projects/${opts.project}/errors`;
    let payload = jsonifyNotice(notice, opts);

    let req = new XMLHttpRequest();
    req.open('POST', url, true);
    req.timeout = opts.timeout;
    req.setRequestHeader('X-Api-Key', opts.apiKey);
    req.onreadystatechange = () => {
        if (req.readyState !== 4) {
            return;
        }
        if (req.status >= 200 && req.status < 500) {
            let resp = JSON.parse(req.responseText);
            if (resp.id) {
                notice.id = resp.id;
                promise.resolve(notice);
                return;
            }
            if (resp.error) {
                let err = new Error(resp.error);
                promise.reject(err);
                return;
            }
        }

        let body = req.responseText.trim();
        let err = new Error(
            `faultline: unexpected response: code=${req.status} body='${body}'`);
        promise.reject(err);
    };
    req.send(payload);
}
