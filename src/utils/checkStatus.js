module.exports = function checkStatus(resp) {
  const { status, statusText } = resp;
  if (status >= 200 && status < 300) {
    return resp;
  }
  return new Error(statusText);
};
