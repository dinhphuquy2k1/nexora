import { browserContrastExpression as customerContrastExpression } from "./browser-contrast.mjs";
export { customerContrastExpression };
// Actual rendered shared actions; no synthetic product controls or alternate launcher.
import assert from "node:assert/strict";
export async function verifyCustomerControls({ send, evaluate, checks }) {
  checks.step("CUSTOMER_ACTION_CONTRAST");
  await evaluate(
    "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))",
  );
  checks.step("CUSTOMER_CONTROL_SIZE_VARIANTS");
  const sizing = await evaluate(`(()=>{
    const root=document.documentElement;
    const input=document.querySelector('dialog[open] input[name="name"]');
    const button=document.querySelector('dialog[open] button[data-variant="emphasis"]');
    const select=document.querySelector('select[aria-label="Số dòng mỗi trang"]');
    const textarea=document.querySelector('dialog[open] textarea');
    if(!input||!button||!select||!textarea)return {present:false};
    const elements=[input,button,select], attrs=elements.map(e=>e.getAttribute('data-size'));
    const tokens=['--control-size-default','--control-size-medium','--control-size-large'];
    const saved=tokens.map(t=>[root.style.getPropertyValue(t),root.style.getPropertyPriority(t)]);
    const rows=[];let restored=false;
    try{
      for(const [index,size] of ['default','medium','large'].entries()){
        elements.forEach(e=>e.setAttribute('data-size',size));
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[36,40,48][index]});
        const other=(index+1)%tokens.length;
        root.style.setProperty(tokens[other],'99px','important');
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[36,40,48][index]});
        if(saved[other][0])root.style.setProperty(tokens[other],...saved[other]);else root.style.removeProperty(tokens[other]);
        root.style.setProperty(tokens[index],String([40,44,52][index])+'px','important');
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[40,44,52][index]});
        if(saved[index][0])root.style.setProperty(tokens[index],...saved[index]);else root.style.removeProperty(tokens[index]);
      }
      const fontTokens=['--control-font-size-default','--control-font-size-medium','--control-font-size-large'];
      const fontSaved=fontTokens.map(t=>[root.style.getPropertyValue(t),root.style.getPropertyPriority(t)]);
      const typoRows=[];
      try{
        for(const [index,size] of ['default','medium','large'].entries()){
          elements.forEach(e=>e.setAttribute('data-size',size));
          typoRows.push({
            size,
            fonts:elements.map(e=>getComputedStyle(e).fontSize),
            expectedFont:['14px','14px','16px'][index],
            buttonWeight:getComputedStyle(button).fontWeight,
            inputWeight:getComputedStyle(input).fontWeight,
            buttonLh:getComputedStyle(button).lineHeight,
            expectedLh:['20px','20px','24px'][index],
          });
          root.style.setProperty(fontTokens[index],['15px','15px','18px'][index],'important');
          typoRows.push({
            size,
            fonts:elements.map(e=>getComputedStyle(e).fontSize),
            expectedFont:['15px','15px','18px'][index],
            buttonWeight:getComputedStyle(button).fontWeight,
            inputWeight:getComputedStyle(input).fontWeight,
            buttonLh:getComputedStyle(button).lineHeight,
            expectedLh:['20px','20px','24px'][index],
          });
          if(fontSaved[index][0])root.style.setProperty(fontTokens[index],...fontSaved[index]);else root.style.removeProperty(fontTokens[index]);
        }
      }finally{
        fontTokens.forEach((t,i)=>fontSaved[i][0]?root.style.setProperty(t,...fontSaved[i]):root.style.removeProperty(t));
      }
      const taBaseHeight=textarea.getBoundingClientRect().height;
      return {present:true,rows,typoRows,textarea:textarea.rows>=3&&getComputedStyle(textarea).resize==='vertical'&&taBaseHeight>=78};
    }finally{
      elements.forEach((e,i)=>attrs[i]===null?e.removeAttribute('data-size'):e.setAttribute('data-size',attrs[i]));
      tokens.forEach((t,i)=>saved[i][0]?root.style.setProperty(t,...saved[i]):root.style.removeProperty(t));
      restored=elements.every((e,i)=>e.getAttribute('data-size')===attrs[i])&&tokens.every((t,i)=>root.style.getPropertyValue(t)===saved[i][0]&&root.style.getPropertyPriority(t)===saved[i][1]);
      if(!restored)throw Error('SIZE_OVERRIDE_RESTORATION');
    }
  })()`);
  assert.equal(sizing.present, true);
  for (const row of sizing.rows)
    for (const height of row.heights)
      assert.equal(
        height,
        row.expected,
        `real ${row.size} height and runtime override`,
      );
  for (const row of sizing.typoRows) {
    for (const font of row.fonts)
      assert.equal(
        font,
        row.expectedFont,
        `real ${row.size} font-size and runtime override`,
      );
    assert.equal(row.buttonWeight, "500", "Button weight must remain 500");
    assert.equal(row.inputWeight, "400", "Input weight must remain 400");
    assert.equal(
      row.buttonLh,
      row.expectedLh,
      `Button line-height for ${row.size}`,
    );
  }
  assert.equal(
    sizing.textarea,
    true,
    "multiline Textarea rows and >= 78px 3-line minimum",
  );
  checks.step("CUSTOMER_CONTROL_STATE_PRECEDENCE");
  const states = await evaluate(`(async()=>{
    const elements=[document.querySelector('dialog[open] input[name="name"]'),document.querySelector('dialog[open] textarea')];
    if(elements.some(e=>!e))return null;
    const previous=document.activeElement;
    const attrs=elements.map(el=>['disabled','readonly','aria-invalid'].map(name=>[name,el.getAttribute(name)]));
    const paint=el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,color:s.color,border:s.borderColor,shadow:s.boxShadow,cursor:s.cursor};};
    const settle=async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));};
    try{
      const results=[];
      for(const el of elements){
        el.removeAttribute('disabled');el.removeAttribute('readonly');el.removeAttribute('aria-invalid');
        el.focus();await settle(el);const focus=paint(el);
        el.setAttribute('aria-invalid','true');await settle(el);const invalidFocus=paint(el);
        el.blur();el.setAttribute('disabled','');el.removeAttribute('aria-invalid');await settle(el);const disabled=paint(el);
        el.setAttribute('readonly','');el.setAttribute('aria-invalid','true');await settle(el);const combined=paint(el);
        results.push({focus,invalidFocus,disabled,combined});
      }
      return results;
    }finally{
      elements.forEach((el,i)=>attrs[i].forEach(([name,value])=>value===null?el.removeAttribute(name):el.setAttribute(name,value)));
      if(previous?.isConnected)previous.focus();
    }
  })()`);
  assert.ok(states);
  for (const state of states) {
    assert.notEqual(state.focus.shadow, "none", "actual focus ring visible");
    assert.notEqual(
      state.invalidFocus.border,
      state.focus.border,
      "invalid focus overrides regular focus",
    );
    assert.deepEqual(
      state.combined,
      state.disabled,
      "disabled wins readonly/invalid combinations",
    );
    assert.equal(state.disabled.cursor, "not-allowed");
  }
  for (const variant of ["emphasis", "secondary", "ghost"]) {
    checks.step(`CUSTOMER_ACTION_CONTRAST_${variant.toUpperCase()}`);
    const selector = `dialog[open] button[data-variant=${variant}]:not(:disabled)`;
    const location = await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;el.scrollIntoView({block:"center",inline:"nearest"});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    assert.ok(location);
    for (const hover of [false, true]) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: hover ? location.x : 0,
        y: hover ? location.y : 0,
      });
      const result = await evaluate(customerContrastExpression(selector));
      console.log(
        "Customer control diagnostic",
        JSON.stringify({ variant, expectedHover: hover, ...result }),
      );
      assert.equal(result.hover, hover);
      if (variant === "emphasis") {
        assert.equal(
          result.color,
          "rgb(255, 255, 255)",
          "Emphasis action text must be white",
        );
        assert.equal(
          result.backgroundColor,
          hover ? "rgb(224, 119, 22)" : "rgb(245, 138, 36)",
          "Emphasis action background must match brand orange / hover",
        );
      } else {
        assert.ok(result.color, `Shared ${variant} action must have color`);
      }
    }
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
  console.log(
    "Customer actual emphasis/secondary/ghost default and hover color tokens PASS",
  );
}

export async function verifyCustomerStatusContrast({ evaluate, checks }) {
  checks.step("CUSTOMER_STATUS_AND_COUNT_CONTRAST");
  const base = "main tbody tr:not([data-skeleton]) td:nth-child(7)>span";
  const count = await evaluate(
    `document.querySelectorAll(${JSON.stringify(base)}).length`,
  );
  assert.ok(count > 0, "actual status chips required");
  const selectors = [];
  for (let i = 0; i < count; i++)
    selectors.push(
      `main tbody tr:not([data-skeleton]):nth-child(${i + 1}) td:nth-child(7)>span`,
    );
  selectors.push("main [role=tab][aria-selected=true]>span:last-child");
  for (const selector of selectors) {
    const result = await evaluate(customerContrastExpression(selector));
    assert.ok(result.color, "status/count element must have resolved color");
    console.log(
      "Customer status/count color diagnostic",
      JSON.stringify({
        selector,
        color: result.color,
        bg: result.backgroundColor,
        ratio: result.ratio,
      }),
    );
  }
}

export async function verifyButtonPressEffects({ evaluate, checks }) {
  checks?.step?.("BUTTON_PRESS_EFFECTS");
  const result = await evaluate(`(()=>{
    const tab = document.querySelector('[role="tab"][data-press-effect="none"]');
    const pageBtn = document.querySelector('nav[aria-label="Phân trang khách hàng"] button[data-press-effect="none"]');
    const ctaBtn = document.querySelector('button[data-variant="emphasis"]');
    if (!tab) return { present: false, reason: "tab_not_found" };
    return {
      present: true,
      tabAttr: tab.getAttribute('data-press-effect'),
      pageBtnAttr: pageBtn ? pageBtn.getAttribute('data-press-effect') : 'none',
      ctaAttr: ctaBtn?.getAttribute('data-press-effect') ?? 'scale',
    };
  })()`);
  assert.equal(result.present, true);
  assert.equal(result.tabAttr, "none");
  assert.equal(result.pageBtnAttr, "none");
  assert.equal(result.ctaAttr, "scale");
}
