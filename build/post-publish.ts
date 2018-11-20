import { addGitTag } from '../src'
addGitTag().then((tagName) => {
  console.log(`🌝tag ${tagName} has been added`)
})