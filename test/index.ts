import { deploy, IDeployConfig } from '../src/'
import path from 'path'

const config: IDeployConfig = {
  ssh: {
    host: 'my.server.com',
    username: 'fancy',
    // password: '123456'
    passphrase: '3344',
    privateKey: '/Users/evecalm/.ssh/my-private-key'
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


deploy(config)