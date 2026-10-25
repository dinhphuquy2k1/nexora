// Actual rendered shared actions; no synthetic product controls or alternate launcher.
import assert from "node:assert/strict";
export async function verifyCustomerControls({ send, evaluate, checks }) {
  checks.step("CUSTOMER_ACTION_CONTRAST");
  for (const variant of ["primary", "secondary", "ghost"]) {
    const selector = `dialog[open] button[data-variant=${variant}]:not(:disabled)`;
    const location = await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    assert.ok(location);
    for (const hover of [false, true]) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: hover ? location.x : 0,
        y: hover ? location.y : 0,
      });
      const result = await evaluate(
        `(async()=>{const el=document.querySelector(${JSON.stringify(selector)});await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));const parse=s=>{const n=s.match(/[\\d.]+/g).map(Number);return[n[0],n[1],n[2],n[3]??1];};const chain=[];for(let n=el;n;n=n.parentElement)chain.push(n);let bg=[255,255,255];for(const n of chain.reverse()){const c=parse(getComputedStyle(n).backgroundColor);bg=bg.map((v,i)=>c[i]*c[3]+v*(1-c[3]));}const fg=parse(getComputedStyle(el).color);const text=bg.map((v,i)=>fg[i]*fg[3]+v*(1-fg[3]));const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);const a=luminance(text),b=luminance(bg);return{ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),hover:el.matches(':hover'),height:getComputedStyle(el).height,radius:getComputedStyle(el).borderRadius};})()`,
      );
      assert.equal(result.hover, hover);
      assert.ok(
        result.ratio >= 4.5,
        `Shared ${variant} action contrast must meet4.5`,
      );
    }
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
  console.log(
    "Customer actual primary/secondary/ghost default and hover contrast PASS",
  );
}
