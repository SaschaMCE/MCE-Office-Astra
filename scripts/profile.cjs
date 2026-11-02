// Comparable readback-complete timings; software WebGL is not a target-PC FPS claim.
const {chromium} = require('playwright');
const {fork, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const baseline = process.argv[2];
const artifacts = path.join(root, '.artifacts');
fs.mkdirSync(artifacts,{recursive:true});
let bundle;
if (baseline) {
  bundle = path.join(artifacts,'profile-baseline.js');
  fs.writeFileSync(bundle,execFileSync('git',['show',`${baseline}:app/web/browser/main-T4VOFCRR.js`],{cwd:root,maxBuffer:8*1024*1024}));
}
(async()=>{
 const server=fork(path.join(__dirname,'serve.cjs'),['--test'],{env:{...process.env,MCE_PORT:'4176',...(bundle?{MCE_TEST_BUNDLE:bundle}:{})},stdio:['ignore','inherit','inherit','ipc']});
 let browser;
 try {
  await new Promise((resolve,reject)=>{server.once('message',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`server exited ${code}`)));});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:960,height:640}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:4176/');
  console.log('Profile: page loaded');
  await page.waitForFunction(()=>window.__mceView?.drawn,null,{timeout:120000});
  console.log('Profile: first frame ready');
  const result=await page.evaluate(()=>{
   const v=window.__mceView,r=v.renderer;
   r.setAnimationLoop(null);v.finishIntro(true);document.getElementById('mce-go')?.click();
   r.setPixelRatio(1);r.setSize(800,550,false);v.camera.aspect=800/550;v.camera.updateProjectionMatrix();v.ambientShading?.resize();
   const measures=[];
   for(const place of ['welcome','coffee']) {
    v.finishIntro(true,place);v.camera.position.set(v.pos[0],1.62,v.pos[1]);v.camera.rotation.set(0,v.yaw,0);
    for(const detail of [false,true]) {
     const times=[];
     const pixel = new Uint8Array(4), gl = r.getContext();
     for(let i=0;i<16;i++) {
      r.info.autoReset=false;r.info.reset();
      const begin=performance.now();
      if(detail&&v.ambientShading)v.ambientShading.render(v.office.scene);else r.render(v.office.scene,v.camera);
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      if(gl.isContextLost() || pixel[3] !== 255) throw Error('Render readback failed');
      if(i>=4)times.push(performance.now()-begin);
     }
     times.sort((a,b)=>a-b);
     measures.push({place,mode:detail?'detail':'smooth',medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.floor(times.length*.95)],drawCalls:r.info.render.calls,triangles:r.info.render.triangles});
    }
   }
   return {measures,geometry:v.renderer.info.memory.geometries};
  });
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(artifacts,baseline?'profile-before.json':'profile-after.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
 } finally {await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
