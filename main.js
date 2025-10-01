import fs from "fs";
import chalk from "chalk";

function ChangedSourceCode() {

}

fs.watch("main.cpp", (eventType, filename) => {
    if (eventType == "change") {
        ChangedSourceCode();
    }
});

console.log(chalk.red("AtCoderTools Launched"));