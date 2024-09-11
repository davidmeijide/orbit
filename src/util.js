// yyyy-MM-ddThh:mm:ss
export function formatDatetime(datetime) {
  let str = "";
  str = `${datetime.getFullYear()}/${pad(datetime.getMonth() + 1)}/${pad(
    datetime.getDate()
  )} `;
  str += `${pad(datetime.getHours())}:${pad(datetime.getMinutes())}:${pad(
    datetime.getSeconds()
  )}`;

  return str;
}
export function pad(int) {
  return int.toString().padStart(2, "0");
}
