import { deploy, IDeployConfig, runCmd, findFileRecursive } from '../src/'
import path from 'path'

const config: IDeployConfig = {
  ssh: {
    host: '192.168.2.2',
    username: 'evecalm',
    // password: '123456'
    passphrase: 'sss',
    // support ~ as user homedir
    privateKey: '~/.ssh/solo'
  },
  log: true,
  cmds: [
    {
      type: 'cmd',
      args: ['mkdir', '-p', 'saiya/test'],
      cwd: '~'
    },
    {
      type: 'cmd',
      args: ['ls', 'saiya', '-l'],
      cwd: '~'
    },
    {
      type: 'cmd',
      args: ['pm23', 'saiya', '-l'],
      cwd: '~',
      allowFailure: true
    },
    {
      type: 'upload',
      src: path.join(__dirname, '../*.json'),
      srcPrefix: path.join(__dirname, '..'),
      dest: '/home/kk/saiya'
    },
    {
      type: 'download',
      src: '/home/kk/start.sh',
      dest: path.join(__dirname, 'gg.sh')
    }
  ]
}


deploy(config).then(() => {
  console.log('all done')
})

runCmd('ls', ['-al']).then((res) => {
  console.log(res)
})


console.log(findFileRecursive('.git', process.cwd(), true))