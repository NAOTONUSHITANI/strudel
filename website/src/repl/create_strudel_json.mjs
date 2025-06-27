
import { createInterface } from 'node:readline';
import * as fs from 'node:fs'

const validFileTypes = new Set(['.wav', '.mp3', '.aac', '.m4a'])
/** For automatically creating the strudel JSON that for samples hosted in a remote repo */
async function writeStrudelJson(subpath, hosturl) {
  const children = await fs.promises.readdir(subpath, { recursive: true });
  const name = subpath.split('/').slice(-1)[0];
  const tree = { name, children };
  let samples = {
    _base: hosturl
  };

  const files = tree.children.filter((path) => {
    const extension = path.match(/\.[0-9a-z]+$/i)?.[0]
    return validFileTypes.has(extension)
  }).sort((a, b) => a.localeCompare(b))

  files.forEach(path => {
    const groupName = path.match(/([^/]+)\/[^/]+$/)[1]
    samples[groupName] = samples[groupName] ?? []
    samples[groupName].push(path)
  })
  const json = JSON.stringify(samples, null, 2);
  const filepath = subpath + '/strudel.json';
  await fs.promises.writeFile(filepath, json);
  console.log(`wrote strudel.json with ${files.length} samples to ${subpath}`);
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(`enter sample folder path: `, async path => {
  rl.question(`enter hosted URL: `, async hosturl => {
    const githubregex = /github\.com\/([^/]+)\/([^/]+)/;
    const githubparams = hosturl.match(githubregex);
    if (githubparams) {
      const username = githubparams[1];
      const repo = githubparams[2];

      hosturl = `https://raw.githubusercontent.com/${username}/${repo}/main/`
      console.log('reformatting github URL to: ', hosturl)
    }

    await writeStrudelJson(path, hosturl)
    rl.close();
  })

});