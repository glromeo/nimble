import fastDiff, { Diff } from "fast-diff";
import JasmineStartedInfo = jasmine.JasmineStartedInfo;
import SpecResult = jasmine.SpecResult;
import SuiteResult = jasmine.SuiteResult;
import JasmineDoneInfo = jasmine.JasmineDoneInfo;
import CustomReporter = jasmine.CustomReporter;

export default {
    jasmineStarted(startedInfo: JasmineStartedInfo) {
        console.group("jasmine: started, total specs defined:", startedInfo.totalSpecsDefined);
    },

    suiteStarted(suite: SuiteResult) {
        console.group(`jasmine suite: ${suite.fullName} %c...`, "color: gray");
    },

    specStarted(spec: SpecResult) {
        console.log(`jasmine spec: ${spec.description} %c...`, "color: gray");
    },

    specDone({ failedExpectations, description, passedExpectations, pendingReason, status }: SpecResult) {
        if (status === "pending") {
            console.log(
                `jasmine spec: ${description}%c - %cPENDING%c because ${pendingReason}`,
                "color: gray",
                "color: orange",
                "color: auto"
            );
        } else {
            console.log(
                `jasmine spec: ${description}%c - %c${passedExpectations.length} PASSED%c, %c${failedExpectations.length} FAILED`,
                "color: gray",
                "color: green",
                "color: gray",
                "color: red"
            );
        }

        for (let i = 0; i < failedExpectations.length; i++) {
            const failure = failedExpectations[i];

            if (failure.message.startsWith("expected snapshot:")) {
                console.groupCollapsed(
                    `jasmine spec failure: %csnapshot doesn't match!\n\t%c${failure.stack.trim()}`,
                    "color: red;",
                    "color: orange;"
                );

                const start = failure.message.indexOf("\n") + 1;
                const end = failure.message.indexOf("\nto match:\n", start);
                const left = failure.message.slice(start, end);
                const right = failure.message.slice(end + 11, -1);

                const parts: Diff[] = [] || fastDiff(left, right);
                let message, styles;

                console.groupCollapsed(
                    "%cexpected%c:",
                    "color: dodgerblue; text-decoration: underline;",
                    "color:auto; text-decoration: auto;"
                );

                message = "";
                styles = [];
                for (let [type, text] of parts)
                    if (type === 0) {
                        message += "%c" + text;
                        styles.push("color: gray; background: none; border: none;");
                    } else if (type < 0) {
                        message += "%c" + text;
                        styles.push(
                            "color: dodgerblue; background: rgba(30, 144, 255, .125); border: 1px solid dodgerblue;"
                        );
                    }

                console.log(message, ...styles);
                console.groupEnd();

                console.groupCollapsed(
                    "%cactual%c:",
                    "color: darkorange; text-decoration: underline;",
                    "color:auto; text-decoration: auto;"
                );

                message = "";
                styles = [];
                for (let [type, text] of parts)
                    if (type === 0) {
                        message += "%c" + text;
                        styles.push("color: gray; background: none; border: none;");
                    } else if (type > 0) {
                        message += "%c" + text;
                        styles.push(
                            "color: darkorange; background: rgba(255, 140, 0, .125); border: 1px solid darkorange;"
                        );
                    }

                console.log(message, ...styles);
                console.groupEnd();

                console.groupEnd();
            } else {
                console.log(`jasmine spec failure: ${failure.message}\n%c${failure.stack.trim()}`, "color: orange;");
            }
        }
    },

    suiteDone({ failedExpectations, fullName, status }: SuiteResult) {
        console.groupEnd();
        console.log(
            `jasmine suite: ${fullName} %c- %c${status.toUpperCase()}`,
            "color: gray",
            status === "passed" ? "color:green" : status === "pending" ? "color:orange" : "color:red"
        );
        for (let i = 0; i < failedExpectations.length; i++) {
            console.log("jasmine: suite failure: " + failedExpectations[i].message);
            console.log(failedExpectations[i].stack);
        }
    },

    jasmineDone({ overallStatus, totalTime, failedExpectations }: JasmineDoneInfo) {
        console.groupEnd();
        console.log(
            `jasmine: done: status %c${overallStatus}%c, total-time: %c${totalTime}ms`,
            overallStatus === "passed" ? "color:green" : overallStatus === "pending" ? "color:orange" : "color:red",
            "color: auto",
            "color: cornflowerblue"
        );
        for (let i = 0; i < failedExpectations.length; i++) {
            console.log("jasmine: global failure: " + failedExpectations[i].message, failedExpectations[i].stack);
        }
    }
} as CustomReporter;
