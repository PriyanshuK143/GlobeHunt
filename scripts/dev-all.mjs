import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const commands = [
  [npm, ['--prefix', 'server', 'run', 'dev']],
  [npm, ['run', 'dev']],
]

let stopping = false
const children = commands.map(([command, args]) =>
  spawn(command, args, { stdio: 'inherit', env: process.env }),
)

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
  }, 2_000).unref()
  process.exitCode = exitCode
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1)
  })
}
