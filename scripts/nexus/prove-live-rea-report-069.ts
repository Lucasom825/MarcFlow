/**
 * Real public HTTP smoke, read-only. Requires GitHub Actions outbound access.
 * Fails closed if publisher hasn't produced a valid successful REA run.
 */
import {loadVerifiedPublicReaReport,fetchPublicReaGitHub}
  from "../../src/lib/nexus-rea-public-report";
async function verifyLive(){
const report=await loadVerifiedPublicReaReport(fetchPublicReaGitHub);
if(report.target.repository!=="axios/axios" || report.target.directory!=="lib" ||
  report.checks.ast_js_files!==72 || report.checks.rea_parsed_js!==72 ||
  report.checks.ast_import_sites!==200 || report.checks.matched_import_sites!==200 ||
  report.checks.source_executed!==false)throw Error("Unexpected real REA publisher output");
console.log("NEXUS069_LIVE_GITHUB_SOURCE_VERIFIED=true");
console.log("NEXUS069_LIVE_REPORT_RUN_ID="+report.run_id);
console.log("NEXUS069_STATUS="+report.status);

}
verifyLive().catch(error=>{console.error(error);process.exitCode=1;});
