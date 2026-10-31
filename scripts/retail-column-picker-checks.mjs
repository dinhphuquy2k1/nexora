import assert from "node:assert/strict";

// Actual DOM/CSS inspection in the existing CDP session. Probe only resolves theme
// values; it never changes the controls or manufactures hover/focus states.
export const columnPickerVisualExpression = `(()=>{
 const panel=document.querySelector('[role=dialog][aria-label="Tùy chỉnh cột hiển thị"]');
 if(!panel)return null;
 const root=getComputedStyle(document.documentElement),probe=document.createElement('span');
 function nativeCancelRuleHidden(input){
  function rules(list){return [...list].some(r=>(r.selectorText?.includes('::-webkit-search-cancel-button')&&r.style.display==='none'&&r.selectorText.split(',').some(s=>input.matches(s.replace('::-webkit-search-cancel-button','').trim())))||(r.cssRules&&rules(r.cssRules)));}
  return [...document.styleSheets].some(s=>rules(s.cssRules));
 }
 document.body.append(probe);
 function token(name,property='color'){const raw=root.getPropertyValue(name).trim();if(!raw)throw Error('MISSING_PICKER_TOKEN');probe.style[property]=raw;return getComputedStyle(probe)[property];}
 function rect(e){const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};}
 function fits(e){const r=rect(e);return e.scrollWidth<=e.clientWidth+1&&r.width>0;}
 try{
 const style=getComputedStyle(panel),p=rect(panel),title=panel.querySelector('[class*=colPickerHeaderTitle]'),ts=getComputedStyle(title);
 const header=panel.querySelector('[class*=colPickerHeader]'),footer=panel.querySelector('[class*=colPickerFooter]'),count=panel.querySelector('[class*=colPickerFooterCount]'),done=footer.querySelector('button');
 const search=panel.querySelector('input[type=search]'),ss=getComputedStyle(search),sr=rect(search),icon=panel.querySelector('[class*=colPickerSearchIcon]'),clear=panel.querySelector('button[aria-label="Xóa tìm kiếm"]');
 const group=panel.querySelector('[aria-label="Chọn cấu hình cột"]'),buttons=[...group.querySelectorAll('button')],separators=[...group.querySelectorAll('span')].filter(e=>e.textContent==='|');
 const choices=panel.querySelector('[class*=columnChoices]'),cs=getComputedStyle(choices),cr=rect(choices);
 const rows=[...choices.querySelectorAll('label')].map(row=>{const input=row.querySelector('input[type=checkbox]'),label=row.querySelector('[class*=colOptionLabel]'),badge=row.querySelector('[class*=colPinnedBadge]'),s=getComputedStyle(label),rr=rect(row),lr=rect(label),ir=rect(input);return {checked:input.checked,disabled:input.disabled,native:input.tagName==='INPUT'&&input.type==='checkbox',color:s.color,weight:s.fontWeight,row:rr,label:lr,input:ir,badge:badge?{text:badge.textContent,color:getComputedStyle(badge).color,bg:getComputedStyle(badge).backgroundColor,border:getComputedStyle(badge).borderColor,rect:rect(badge)}:null};});
 return {
  panel:p,width:innerWidth,radius:style.borderRadius,padding:style.paddingTop,gap:style.rowGap,border:style.borderTopColor,bg:style.backgroundColor,shadow:style.boxShadow,
  title:{size:ts.fontSize,weight:ts.fontWeight,color:ts.color,lineHeight:ts.lineHeight,fits:fits(title)},
  presets:buttons.map((b,i)=>{const s=getComputedStyle(b),label=b.querySelector('span');return {text:b.textContent,pressed:b.getAttribute('aria-pressed'),color:getComputedStyle(label).color,bg:s.backgroundColor,border:s.borderTopWidth,shadow:s.boxShadow,hover:b.matches(':hover'),reset:!!b.querySelector('svg.lucide-rotate-ccw'),expected:token(['--color-colpicker-preset-all','--color-colpicker-preset-basic','--color-colpicker-preset-default'][i])};}),
  separators:separators.map(e=>({hidden:e.getAttribute('aria-hidden'),interactive:e.tabIndex>=0||!!e.closest('button,a,input')})),
  search:{value:search.value,rect:sr,bg:ss.backgroundColor,color:ss.color,border:ss.borderTopColor,shadow:ss.boxShadow,focused:document.activeElement===search,leftPadding:parseFloat(ss.paddingLeft),rightPadding:parseFloat(ss.paddingRight),icon:rect(icon),clear:clear?{rect:rect(clear),size:clear.dataset.size}:null,cancelHidden:nativeCancelRuleHidden(search)},
  checklist:{max:cs.maxHeight,height:choices.clientHeight,scrollHeight:choices.scrollHeight,overflow:cs.overflowY,scrollTop:choices.scrollTop,rect:cr,rows},
  footer:{size:getComputedStyle(count).fontSize,text:count.textContent,rect:rect(footer),count:rect(count),button:rect(done),bg:getComputedStyle(done).backgroundColor,color:getComputedStyle(done).color,divider:getComputedStyle(footer).borderTopWidth,padding:getComputedStyle(footer).paddingTop},
  expected:{primary:token('--color-primary'),unselected:token('--color-colpicker-option-unselected-text'),badge:token('--brand-orange-text'),badgeBg:token('--amber-50'),badgeBorder:token('--amber-200'),surface:token('--color-surface'),border:token('--color-border'),shadow:token('--shadow-lg','boxShadow'),muted:token('--color-surface-muted'),focus:token('--control-focus-border'),focusRing:token('--control-focus-ring'),white:token('--color-white'),navy:token('--brand-navy')},
  count:document.querySelectorAll('colgroup col').length,headerPadding:getComputedStyle(header).paddingBottom,
 };
 }finally{probe.remove();}
})()`;

export async function inspectRetailColumnPicker(evaluate) {
  await evaluate(
    `Promise.all((document.querySelector('[role=dialog][aria-label="Tùy chỉnh cột hiển thị"]')?.getAnimations({subtree:true})??[]).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))).then(()=>true)`,
  );
  const m = await evaluate(columnPickerVisualExpression);
  if (!m) return null;
  assert.equal(m.radius, "12px");
  assert.ok(m.panel.width <= Math.min(336, m.width - 32) + 1);
  if (m.width >= 768) assert.ok(Math.abs(m.panel.width - 336) < 1);
  assert.ok(m.panel.left >= 0 && m.panel.right <= m.width);
  assert.equal(m.padding, "12px");
  assert.equal(m.gap, "8px");
  assert.equal(m.headerPadding, "8px");
  assert.equal(m.border, m.expected.border);
  assert.equal(m.bg, m.expected.surface);
  assert.equal(m.shadow, m.expected.shadow);
  assert.deepEqual(
    [m.title.size, m.title.weight, m.title.color],
    ["12px", "700", m.expected.primary],
  );
  assert.ok(parseFloat(m.title.lineHeight) >= 12 && m.title.fits);
  assert.equal(m.presets.length, 3);
  assert.equal(m.separators.length, 2);
  for (const separator of m.separators)
    assert.deepEqual(separator, { hidden: "true", interactive: false });
  assert.ok(m.presets[2].reset);
  for (const preset of m.presets) {
    assert.equal(
      preset.color,
      preset.expected,
      "preset retains its own semantic text color",
    );
    assert.equal(preset.shadow, "none");
    assert.equal(preset.border, "0px");
    assert.equal(
      preset.bg,
      preset.hover ? m.expected.surface : "rgba(0, 0, 0, 0)",
    );
  }
  assert.ok(m.presets.filter((p) => p.pressed === "true").length <= 1);
  const presetCount = [20, 7, 19][
    m.presets.findIndex((p) => p.pressed === "true")
  ];
  if (presetCount !== undefined) assert.equal(m.count, presetCount);
  assert.equal(m.search.rect.height, 32);
  assert.equal(
    m.search.bg,
    m.search.focused ? m.expected.surface : m.expected.muted,
  );
  if (m.search.focused) {
    assert.equal(m.search.border, m.expected.focus);
    assert.ok(m.search.shadow.includes(m.expected.focusRing));
  }
  assert.ok(m.search.rect.left + m.search.leftPadding >= m.search.icon.right);
  assert.ok(m.search.cancelHidden);
  if (m.search.clear) {
    assert.equal(m.search.clear.rect.width, 32);
    assert.equal(m.search.clear.rect.height, 32);
    assert.equal(m.search.clear.size, "default");
    assert.ok(
      m.search.rect.right - m.search.rightPadding <=
        m.search.clear.rect.left + 1,
    );
  }
  assert.equal(m.checklist.max, "208px");
  assert.equal(m.checklist.overflow, "auto");
  assert.ok(m.checklist.height <= 208);
  for (const row of m.checklist.rows) {
    assert.ok(row.native);
    assert.equal(
      row.color,
      row.checked ? m.expected.primary : m.expected.unselected,
    );
    assert.ok(
      Math.abs(
        row.input.top + row.input.bottom - (row.label.top + row.label.bottom),
      ) < 3,
    );
    assert.ok(
      row.label.left >= m.checklist.rect.left &&
        row.label.right <= m.checklist.rect.right,
    );
    if (row.badge) {
      assert.ok(row.checked && row.disabled);
      assert.equal(row.weight, "700");
      assert.equal(row.badge.text, "Cố định");
      assert.equal(row.badge.color, m.expected.badge);
      assert.equal(row.badge.bg, m.expected.badgeBg);
      assert.equal(row.badge.border, m.expected.badgeBorder);
      assert.ok(
        row.label.right <= row.badge.rect.left &&
          row.badge.rect.right <= m.checklist.rect.right,
      );
    }
  }
  if (!m.search.value)
    assert.ok(
      m.checklist.rows.some((r) => r.disabled && r.badge),
      "native required tracking row remains present",
    );
  assert.equal(m.footer.size, "11px");
  assert.equal(
    m.footer.text.replace(/\s+/g, " ").trim(),
    `Đang bật: ${m.count}/20 cột`,
  );
  assert.equal(m.footer.button.height, 32);
  assert.equal(m.footer.bg, m.expected.navy);
  assert.equal(m.footer.color, m.expected.white);
  assert.equal(m.footer.divider, "1px");
  assert.equal(m.footer.padding, "8px");
  assert.ok(m.footer.count.right <= m.footer.button.left);
  assert.ok(
    Math.abs(
      m.footer.count.top +
        m.footer.count.bottom -
        (m.footer.button.top + m.footer.button.bottom),
    ) < 2,
  );
  return m;
}

// Real pointer events, shared CDP transport; no programmatic click/hover styling.
export async function pickerPointer(
  send,
  evaluate,
  selector,
  action = "click",
) {
  const p = await evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('PICKER_POINTER_MISSING');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`,
  );
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...p });
  if (action === "hover") return;
  if (action === "wheel") {
    await send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      ...p,
      deltaX: 0,
      deltaY: 600,
    });
    return;
  }
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", {
      type,
      ...p,
      button: "left",
      clickCount: 1,
    });
}
