// Inject the real CSS-loader output in the isolated fixture, including CSS Modules.
module.exports = function () {};
module.exports.pitch = function (remainingRequest) {
  return `import sheet from ${JSON.stringify("!!" + remainingRequest)};const style=document.createElement('style');style.textContent=sheet.toString();document.head.append(style);export default sheet.locals||{};`;
};
