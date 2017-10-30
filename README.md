# bonefire

A simple Node.js tool that fetches and uploads Jawbone UP data to a Firebase app. (Because Jawbone UP is a dead product. Get your data out while you still can!)

## installation

1. Clone this repository.
1. Ensure you have `node` version 8.x and `npm` version 5.x installed.
1. Install the project dependencies by running the command `npm install` in your Terminal program.

## usage

The core command of this tool is `fetch`, and it takes one of the following `type`s:

- `steps`
- `sleeps`
- `heartrates`

The following top-level documentation can also be viewed at any time by running `./bonefire.js --help`.

```
bonefire.js <cmd> [args]

Commands:
  bonefire.js fetch <type>  fetch Jawbone UP data of a particular <type>

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

Command-specific documentation is viewed with `./bonefire.js <cmd> --help` and will display as follows (here for the core `fetch` command):

```
bonefire.js fetch <type>

fetch Jawbone UP data of a particular <type>

Positionals:
  type  Jawbone datatype from: steps, sleeps, heartrates     [string] [required]

Options:
  --version       Show version number                                  [boolean]
  --help          Show help                                            [boolean]
  --interval, -i                                                [default: 10000]
```
