import { createInterface } from "node:readline";
export function confirm(question, existingRl = null) {
    return new Promise((resolve) => {
        if (existingRl) {
            existingRl.question(`${question} (y/n) `, (answer) => {
                resolve(answer.trim().toLowerCase() === "y");
            });
            return;
        }
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(`${question} (y/n) `, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === "y");
        });
    });
}
