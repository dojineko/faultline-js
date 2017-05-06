import {Notice, AirbrakeError} from '../airbrake-js/src/notice';


function formatError(err: AirbrakeError): string {
    let s: string[] = [];
    s.push(`${err.message}\n`);

    for (let rec of err.backtrace) {
        if (rec.function !== '') {
            s.push(` at ${rec.function}`);
        }
        if (rec.file !== '') {
            s.push(` in ${rec.file}:${rec.line}`);
            if (rec.column !== 0) {
                s.push(`:${rec.column}`);
            }
        }
        s.push('\n');
    }

    return s.join('');
}


export default function report(notice: Notice): void {
    if (!console.log) {
        return;
    }
    for (let err of notice.errors) {
        console.log(formatError(err));
    }
}
