/**
 * Client-safe default for the first REA static analysis.
 * Pick application sources rather than oversized test fixtures when available.
 * This is a UI suggestion only: the server still validates the selected path.
 */
export function chooseReaDefaultDirectory(candidates:readonly string[]):string {
  for(const preferred of ["src","lib","source","app"]){
    if(candidates.includes(preferred))return preferred;
  }
  return candidates.find(path=>!path.split("/").some(part=>
    ["test","tests","__tests__","fixture","fixtures"].includes(part.toLowerCase())))
    ?? candidates[0] ?? "";
}
