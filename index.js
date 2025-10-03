import fs from "fs";
import chalk from "chalk";
import inquirer from "inquirer";
import { JSDOM } from "jsdom";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { resourceLimits } from "worker_threads";
import readline from "readline";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hr = "─".repeat(50);

async function Launch() {
  console.log("Launching...");
  const config = await LoadConfig();
  const session = await LoadSession();
  let contest = "";
  let problem = "";

  async function LoadConfig() {
    if (fs.existsSync("atcodertoolsconfig.json")) {
      try {
        const config = JSON.parse(fs.readFileSync("atcodertoolsconfig.json", "utf-8"));
        // ビルドコマンドの中のプレースホルダーを置換
        config.build = config.build.replace("{MAIN_FILE}", config.main);
        console.log("Loaded config:", config);
        return config;  // 修正: mainではなくconfigを返す
      } catch(err) {
        console.error(chalk.red("Something went wrong", err));
      }
    } else {
      const answers = await inquirer.prompt([
        { type: "input", name: "main", message: "Enter the path of mainfile:" },
        { type: "input", name: "build", message: "Enter the build command:" },
        { type: "input", name: "run", message: "Enter the run command:" },
      ]);
  
      if (!answers.main || !answers.run) {
        console.error(chalk.red("Mainfile and Run command are required"));
        process.exit(1);
      }
  
      fs.writeFileSync("atcodertoolsconfig.json", JSON.stringify(answers), "utf-8");
      LoadConfig();
      console.log(chalk.green("Successfully initialized!"));
      return answers;
    }
  }
  
  async function LoadSession() {
    if (fs.existsSync("session")) {
      return fs.readFileSync("session", "utf-8");
    } else {
      console.warn(chalk.yellow("! This is TOP SECRET. Please never share ./session"));
      const { session } = await inquirer.prompt([
        { type: "input", name: "session", message: "Enter the cookie value: Cookie[https://atcoder.jp]:REVEL_SESSION:" }
      ]);
      fs.writeFileSync("session", session, "utf-8");
      console.log(chalk.green("Successfully registered the session ID!"));
      return session;
    }
  }
  
  async function SetContest() {
    const { contest } = await inquirer.prompt([
      { type: "input", name: "contest", message: "Enter the contest name:" }
    ]);
    console.log(chalk.green("Contest set to:"), contest);
    return contest;
  }
  
  async function AutoContest() {
    console.log(chalk.blue("HINT: If this mode is luggy, you can set \"autointerval\" on atcodertoolsconfig.json"));
    console.log(chalk.bold("Single key mode activated"));
    console.log(`${chalk.bold("B")}: Build`);
    console.log(`${chalk.bold("T")}: Test`);
    console.log(`${chalk.bold("Q")}: Quit to menu`);
    // console.log(`${chalk.bold("Ctrl+C")}: Force quit`);
    
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume(); // ★ これを忘れるとイベントが来ない！
    
    let busy = false;
    
    const cleanup = () => {
      fs.unwatchFile(config.main);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.removeAllListeners("keypress");
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");
    };
    
    return new Promise((resolve) => {
      process.on("SIGINT", () => {
        cleanup();
        console.log(chalk.yellow("\nForce quitting..."));
        resolve();
      });
      
      process.on("SIGTERM", () => {
        cleanup();
        console.log(chalk.yellow("\nTerminated."));
        resolve();
      });
      
      fs.watchFile(config.main, { interval: config.autointerval || 500 }, async (curr, prev) => {
        if (busy || curr.mtime === prev.mtime) return;
        console.log("Changing detected");
        console.log(hr);
        busy = true;
        await Build();
        await Test("default");
        busy = false;
      });
      
      process.stdin.on("keypress", async (str, key) => {
        if (!key) return; // 安全のため
        if (key.name === "q") {
          cleanup();
          console.log(chalk.yellow("\nQuitting auto mode..."));
          resolve();
          return;
        }
        if (key.ctrl && key.name === "c") {
          // Ctrl+C は SIGINT に任せる
          return;
        }
        
        if (busy) return;
        busy = true;
        
        switch (key.name) {
          case "b":
            console.log("Started to build");
            await Build();
            break;
            case "t":
            console.log("Started to test");
            await Test("default");
            break;
          default:
            console.error(chalk.red(`Unknown command: ${key}`))
            break;
        }
        
        busy = false;
      });
    });
  }
  
  async function DownloadCases() {
    if (!contest) { console.error(chalk.red("Please set contest name before downloading cases")); return; }
    const res = await fetch(`https://atcoder.jp/contests/${contest}/tasks`, {
      headers: {
        "Cookie": `REVEL_SESSION=${session}`
      }
    });
    const html = await res.text();
    const document = new JSDOM(html).window.document;
    const problemsDom = Array.from(
      document.getElementById("main-div")
      .querySelector(".row")
      .querySelectorAll("div")[2]
      .querySelector("div")
      .querySelector("table")
      .querySelector("tbody")
      .querySelectorAll("tr")  
    );
    let problems = [];
    for (const problemDom of problemsDom) {
      const tds = problemDom.querySelectorAll("td");
      let problem = {};
      problem.label = tds[0].querySelector("a").textContent;
      problem.name = tds[1].querySelector("a").textContent;
      problem.url = tds[1].querySelector("a").getAttribute("href");
      problems.push(problem);
    }

    for (const [i, problem] of problems.entries()) {
      console.log(`https://atcoder.jp${problem.url}`);
      const _res = await fetch(`https://atcoder.jp${problem.url}`, {
        headers: {
          "Cookie": `REVEL_SESSION=${session}`
        }
      });
      if (_res.status === 403) {
        console.error(`${contest} has not stared yet`);
      }
      if (_res.status === 404) {
        console.error(`${contest} has not started yet or no such contest`);
      }
      if (_res.redirected) {
        console.warn(chalk.yellow("Need logging in, but not logged in yet or session is expired"));
        fs.rmSync("session");
        await LoadSession();
      }
      const _html = await _res.text();
      const problemDom = new JSDOM(_html).window.document;
      const page = Array.from(
        problemDom
        .getElementById("main-div")
        .querySelector(".row")
        .querySelectorAll("div")[2]
        .querySelector("div")
        .querySelector(".lang-ja")
        .querySelectorAll(".part")
      );
      let cases = Array.from({ length: 810 }, () => ({ input: "", output: "" }));
      for (const p of page) {
        const tit = p.querySelector("section").querySelector("h3").textContent;
        // console.log(tit);
        if (!tit) continue;
        const ma = p.querySelector("section").querySelector("h3").textContent.match(/(入力例|出力例)\s(\d+)/);
        if (ma) {
          const num = Number(ma[2]) - 1;
          const cas = p.querySelector("section").querySelector("pre").textContent;
          if (ma[1] == "入力例") cases[num].input = cas;
          if (ma[1] == "出力例") cases[num].output = cas;
        }
        problems[i].cases = cases;
      }

      console.log(chalk.green(`Complete to download: ${chalk.bold(problem.label)}: ${problem.name}`));
      await new Promise((resolve, reject) => { setTimeout(resolve, 500); });
    }
    if (fs.existsSync(contest) && fs.statSync(contest).isDirectory()) { fs.rmSync(contest, { recursive: true }); }
    fs.mkdirSync(contest);
    for (const problem of problems) {
      // console.log(problem);
      fs.mkdirSync(path.join(__dirname, contest, problem.label));
      fs.writeFileSync(`${path.join(__dirname, contest, problem.label, "label")}`, `${problem.label}`, "utf-8");
      fs.writeFileSync(`${path.join(__dirname, contest, problem.label, "name")}`, `${problem.name}`, "utf-8");
      for (const [i, cas] of problem.cases.entries()) {
        if (!cas.input || !cas.output) continue;
        fs.writeFileSync(`${path.join(__dirname, contest, problem.label, `input${i}.txt`)}`, cas.input, "utf-8");
        fs.writeFileSync(`${path.join(__dirname, contest, problem.label, `output${i}.txt`)}`, cas.output, "utf-8");
      }
    }
  }
  async function DeleteCases() {
    if (contest === "") { console.error(chalk.red("Contest is not set")); return; }
    if (!fs.existsSync(contest) || !fs.statSync(contest).isDirectory()) {
      console.error(chalk.red(`No such contest: ${contest}`));
      return;
    }
    const answers = await inquirer.prompt([
      { type: "input", name: "bool", message: `Are you sure to delete this contest's testcases: ${contest}? (Y/n)` },
    ]);
    if (answers.bool === "y" || answers.bool === "Y")
    fs.rmdirSync(contest, { recursive: true });
    console.log(chalk.green("Successfully to delete!"));
  }
  async function SelectProblem() {
    if (!contest) { console.error(chalk.red("Please set contest name before downloading cases")); return; }
    let choices = [];
    fs.readdirSync(contest).forEach(file => {
      const fullpath = `${contest}/${file}`;
      if (fs.statSync(fullpath).isDirectory()) {
        let a = {};
        a.name = `${chalk.bold(fs.readFileSync(fullpath + "/label"))}: ${fs.readFileSync(fullpath + "/name")}`;
        a.value = fs.readFileSync(fullpath + "/name");
        choices.push(a);
      }
    });
    const { _problem } = await inquirer.prompt([
      {
        type: "list",
        choices: choices,
        name: "_problem",
        message: "Select the problem you will solve"
      }
    ]);
    problem = _problem;
    console.log(chalk.green("Problem set to: "), problem);
  }
  async function Build() {
    try {
      const { stdout, stderr } = await execAsync(config.build, {
        encoding: "utf8",
        env: { ...process.env },
        shell: true
      });

      // stderr の存在は警告として扱い、ビルド失敗とはみなさない
      if (stderr) {
        console.warn(chalk.yellow("Some warning has been detected: \n"), stderr);
      }

      console.log(chalk.green("Successfully to build :)"));
      if (stdout) {
        console.log(stdout);
      }
      return true;
    } catch (error) {
      // execAsync がエラーをスローした場合（終了コードが0以外）は、ビルド失敗とみなす
      console.error(chalk.red("Build error:"), error.message);
      if (error.stderr) {
        console.error(error.stderr);
      }
      return false;
    }
  }

  async function Test(mode) {
    try {
      if (mode === "default") {
        const dir = `${contest}/${problem}`;
        if (!(problem && fs.existsSync(dir) && fs.statSync(dir).isDirectory())) {
          console.error(chalk.red(`${chalk.bold(`${contest}: ${problem}`)} not found`));
          return;
        }

        let commands = [];
        for (const name of fs.readdirSync(dir)) {
          const ma = name.match(/input(\d+)\.txt/);
          if (ma) {
            commands.push(config.run.replace(`{INPUT_FILE}`, `${dir}/input${ma[1]}.txt`).replace(`{MAIN_FILE}`, config.main));
          }
        }
        const normalizeOutput = (text) => {
          return text
            .split('\n')
            .map(line => line.trimEnd()) // 各行末のスペースを削除
            .join('\n')
            .trimEnd(); // 最後の改行を削除
        };

        console.log(dir);
        const tasks = commands.map((cmd, i) => {
          return execAsync(cmd, { timeout: 6000, encoding: "utf8" })
            .then(({ stdout, stderr }) => {
              // stderrがあっても警告として表示するだけ
              if (stderr && stderr.length > 0) {
                console.warn(chalk.yellow("Warning:"), stderr);
              }
              const expected = fs.readFileSync(`${dir}/output${i}.txt`, "utf8");
              if (normalizeOutput(expected) === normalizeOutput(stdout)) {
                return { output: stdout, error: stderr, idx: i, judge: "AC" };
              } else {
                return { output: stdout, error: stderr, idx: i, judge: "WA", expected: expected };
              }
            })
            .catch(err => {
              if (err.killed) {
                return { output: "", error: err.message, idx: i, judge: "TLE" };
              } else {
                // 終了コードが0以外の場合（実行時エラー）
                return { output: err.stdout || "", error: err.stderr || err.message, idx: i, judge: "RE" };
              }
            });
        });
        const results = await Promise.all(tasks);
        // console.log(results);
        for (const result of results) {
          let judge;
          if (result.judge === "AC") judge = chalk.green("AC");
          else if (result.judge === "IE") judge = chalk.red("IE");
          else judge = chalk.hex("#FFA500")(result.judge);

          console.log(`Testcase ${result.idx+1} [${judge}]`);
          if (result.judge === "WA") {
            console.log(hr);
            console.log(chalk.bold("Output:"));
            console.log(result.output);
            if (result.output[result.output.length - 1] !== "\n")console.log();
            console.log(chalk.bold("Expected:"));
            console.log(result.expected);
          }
          if (result.judge === "RE") {
            console.error(chalk.red("Exception detected: "));
            console.error(result.error);
          }
        }
      }
      if (mode === "any") {
        try {
          const { cas } = await inquirer.prompt([
            { type: "editor", message: "Enter the case in your editor.", name: "cas" }
          ]);
          
          // 一時ファイルに入力を保存
          const tempFile = path.join(__dirname, "temp_input.txt");
          fs.writeFileSync(tempFile, cas, "utf8");
          
          try {
            const { stdout, stderr } = await execAsync(config.run.replace("{INPUT_FILE}", tempFile), {
              encoding: "utf8",
              env: { ...process.env },
              shell: true
            });
            
            console.log(hr);
            console.log(chalk.bold("Input:"));
            console.log(cas);
            console.log(hr);
            console.log(chalk.bold("Output:"));
            console.log(stdout);
            
            if (stderr && stderr.length > 0) {
              console.warn(chalk.yellow.bold("Warning:"));
              console.warn(stderr);
            }
          } finally {
            // 一時ファイルを削除
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          }
        } catch (err) {
          if (err.killed) {
            console.error(chalk.red("Time Limit Exceeded"));
          } else {
            console.error(chalk.red("Runtime Error:"));
            console.error(err.stderr || err.message);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red("Test error:"), error.message);
      return false;
    }
  }

  console.log(chalk.red.bold("AtCoderTools Launched"));

  while (true) {
    console.log(hr);
    const choices = [
      { name: chalk.red("Start auto building and test"), value: "a" },
      { name: chalk.yellow("Set contest"), value: "c" },
      { name: chalk.yellow("Download Testcases"), value: "d" },
      { name: chalk.yellow("Delete Testcases"), value: "de" },
      { name: chalk.yellow("Select problem"), value: "s" },
      { name: chalk.green("Build & Test"), value: "bt" },
      { name: chalk.green("Build"), value: "b" },
      { name: chalk.green("Test"), value: "t" },
      { name: chalk.green("Test in any cases"), value: "ta" },
      { name: "Exit", value: "exit" }
    ];

    try {
      const { command } = await inquirer.prompt([
        {
          type: "rawlist",
          name: "command",
          message: "Select an action",
          choices: choices
        }
      ]);

      switch (command) {
        case "a":
          await AutoContest();
          break;
        case "c":
          contest = await SetContest();
          break;
        case "d":
          await DownloadCases();
          break;
        case "de":
          await DeleteCases();
          break;
        case "s":
          await SelectProblem();
          break;
        case "b":
          await Build();
          break;
        case "bt":
          await Build();
          await Test("default");
          break;
        case "t":
          await Test("default");
          break;
        case "ta":
          await Test("any");
          break;
        case "exit":
          process.exit(0);
      }
    } catch (err) {
      if (err.message.includes("User force closed")) {
        console.log(chalk.yellow("\nExiting..."));
        process.exit(0);
      }
      throw err;
    }
  }
}

Launch();
