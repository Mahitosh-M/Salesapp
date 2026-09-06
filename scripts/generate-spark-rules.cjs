// Generate explicit workflow validators from the same field definitions as the forms.
const {modules}=require('../functions/lib/shared/schema.js');
const fs=require('node:fs');
const list=a=>JSON.stringify(a);
let rules=`rules_version = '2';
service cloud.firestore {
 match /databases/{database}/documents {
  function signedIn(){return request.auth != null;}
  function profile(){return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;}
  function active(){return signedIn() && profile().active == true;}
  function admin(){return active() && profile().role == 'Admin';}
  function staff(){return active() && profile().role == 'Staff';}
  function own(d){return staff() && d.assignedStaffId == request.auth.uid;}
  function bounded(){return request.query.limit != null && request.query.limit <= 100;}
  function identifier(s){return s is string && s.matches('^[A-Za-z0-9_.-]{1,179}$');}
  function optionalId(s){return s == '' || identifier(s);}
  function text(s){return s is string && s.size() <= 4000;}
  function date(s){return s is string && s.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');}
  function customerScope(d){return d.get('customerId','') == '' || (identifier(d.customerId) && get(/databases/$(database)/documents/staffCustomers/$(d.customerId)).data.active == true && get(/databases/$(database)/documents/staffCustomers/$(d.customerId)).data.assignedStaffId == d.assignedStaffId);}
  function leadScope(d){return d.get('leadId','') == '' || (identifier(d.leadId) && getAfter(/databases/$(database)/documents/leads/$(d.leadId)).data.assignedStaffId == d.assignedStaffId);}
  function campaignScope(d){return d.get('campaignId','') == '' || (identifier(d.campaignId) && identifier(d.get('customerId','')) && get(/databases/$(database)/documents/campaignAssignments/$(d.campaignId+'_'+d.customerId)).data.assignedStaffId == request.auth.uid);}
  function base(d){return d.title is string && d.title.size() > 0 && d.title.size() <= 180 && d.priority in ['URGENT','HIGH','NORMAL','LOW'] && own(d) && d.assignedStaffName == profile().name && customerScope(d) && leadScope(d) && campaignScope(d) && d.createdAt is string && d.updatedAt is string && d.submittedAt == request.time;}
  function created(d){return d.createdBy == request.auth.uid && d.createdOn == request.time;}
  function unchanged(d){return own(resource.data) && d.createdBy == resource.data.get('createdBy',request.auth.uid) && d.createdAt == resource.data.createdAt && d.createdOn == resource.data.get('createdOn',request.time);}
  function linkedTask(kind,id,d){let t=getAfter(/databases/$(database)/documents/tasks/$(kind+'_'+id)).data;return t.sourceType == kind && t.sourceId == id && t.assignedStaffId == d.assignedStaffId && t.title == d.title && t.customerId == d.get('customerId','');}
  function taskSource(id,d){return (d.sourceType == 'ADMIN' && d.sourceId == id) || (d.sourceType in ['leads','followUps','visits','collectionPromises','customerRequirements','opportunities','reactivations','campaignAssignments','complaints'] && id == d.sourceType+'_'+d.sourceId && getAfter(/databases/$(database)/documents/$(d.sourceType)/$(d.sourceId)).data.assignedStaffId == d.assignedStaffId && getAfter(/databases/$(database)/documents/$(d.sourceType)/$(d.sourceId)).data.title == d.title);}
  function activityFollow(id,d){return d.get('nextFollowUp','') == '' || (getAfter(/databases/$(database)/documents/followUps/$('activity_'+id)).data.assignedStaffId == d.assignedStaffId && getAfter(/databases/$(database)/documents/followUps/$('activity_'+id)).data.dueDate == d.nextFollowUp && getAfter(/databases/$(database)/documents/followUps/$('activity_'+id)).data.customerId == d.get('customerId',''));}
  match /users/{uid} {
   allow get: if signedIn() && (request.auth.uid == uid || admin());
   allow list: if admin() && bounded();
   allow create, update: if admin() && request.resource.data.keys().hasOnly(['uid','name','email','role','active','branchId','updatedAt']) && request.resource.data.uid == uid && request.resource.data.role in ['Admin','Staff'] && request.resource.data.active is bool && text(request.resource.data.name) && text(request.resource.data.email) && (uid != request.auth.uid || (request.resource.data.role == 'Admin' && request.resource.data.active == true));
  }
  match /staffCustomers/{id} {
   allow get: if admin() || (own(resource.data) && resource.data.active == true);
   allow list: if bounded() && (admin() || (own(resource.data) && resource.data.active == true));
   allow create, update: if admin() && request.resource.data.keys().hasOnly(['customerId','name','phone','whatsapp','area','branchId','assignedStaffId','active','sourceUpdatedAt','syncedAt','lastOrderDate','lastOrderCheckedAt']);
  }
  match /collectionSnapshots/{id} {
   allow get: if admin() || (own(resource.data) && resource.data.active == true);
   allow list: if bounded() && (admin() || (own(resource.data) && resource.data.active == true));
   allow create, update: if admin() && request.resource.data.keys().hasOnly(['customerId','name','assignedStaffId','active','outstandingAmount','overdueAmount','oldestDueDate','dueDate','amountRequiringFollowUp','financialSourceUpdatedAt','overdueSourceUpdatedAt','sourceUpdatedAt','syncedAt']);
  }
  match /publicState/{id}{allow get: if active() && id == 'sync';allow write: if admin() && id == 'sync';}
  match /settings/{id}{allow get: if active() && id == 'general';allow write: if admin() && id == 'general';}
`;
for(const[k,m]of Object.entries(modules)){
 const keys=['title','status','priority','assignedStaffId','assignedStaffName','createdAt','createdBy','updatedAt','createdOn','submittedAt',...m.fields.map(f=>f.key),...(k==='tasks'?['sourceType','sourceId']:[])];
 const checks=[`d.keys().hasOnly(${list(keys)})`,`d.status in ${list(m.statuses)}`];
 for(const f of m.fields){
  const v=`d.get('${f.key}','')`;
  let check=f.type==='number'?`(${v} is number && ${v} > 0 && ${v} <= 1000000000000)`:f.type==='date'?`date(${v})`:['customer','staff','lead'].includes(f.type)?`identifier(${v})`:`text(${v})`;
  if(f.options) check+=` && ${v} in ${list(f.options)}`;
  checks.push(f.required?`(${v} != '' && ${check})`:`(${v} == '' || (${check}))`);
 }
 if(k==='leads')checks.push(`d.get('linkedCustomerId','') == '' && d.status != 'CONVERTED'`);
 if(k==='tasks')checks.push(`d.sourceType is string && identifier(d.sourceId)`);
 rules+=` function valid_${k}(d){return ${checks.join(' && ')};}\n`;
 rules+=` match /${k}/{id} {\n`;
 if(m.adminOnly){rules+=k==='messageTemplates'?`allow get: if admin() || (staff() && resource.data.status == 'APPROVED');allow list: if bounded() && (admin() || (staff() && resource.data.status == 'APPROVED'));\n`:`allow get: if admin();allow list: if admin() && bounded();\n`;
 rules+=`allow create, update: if admin();\n`;
 }else{
 rules+=`allow get: if admin() || (staff() && (!exists(/databases/$(database)/documents/${k}/$(id)) || own(resource.data)));\nallow list: if bounded() && (admin() || own(resource.data));\n`;
 let extra=m.task?` && linkedTask('${k}',id,d)`:k==='activities'?` && activityFollow(id,d)`:k==='tasks'?` && taskSource(id,d)`:'';
 rules+=`function valid(d){return base(d) && valid_${k}(d)${extra};}\n`;
 rules+=`allow create: if admin()${k==='campaignAssignments'?'':` || (valid(request.resource.data) && created(request.resource.data))`};\n`;
 let imm=k==='campaignAssignments'?` && request.resource.data.customerId == resource.data.customerId && request.resource.data.campaignId == resource.data.campaignId`:k==='tasks'?` && request.resource.data.sourceType == resource.data.sourceType && request.resource.data.sourceId == resource.data.sourceId`:'';
 rules+=`allow update: if admin()${k==='activities'?'':` || (valid(request.resource.data) && unchanged(request.resource.data)${imm})`};\n`;
 }
 rules+='}\n';
}
rules+=`match /{col}/{id} {
 allow get: if admin() && col in ['customerOrderDates','syncDirtyCustomers','syncState','customerAssignments','monthlyAssignments','targets','branchTargetProgress','businessTargetProgress','targetCoverage','adminInvoiceTargets','adminCis_customers','adminCis_customerCreditProfiles','adminCis_customerIntelligenceSummaries','adminCis_pcBalances','adminCis_customerMonthlySnapshots','adminCis_businessMonthlySnapshots'];
 allow list: if admin() && bounded() && col in ['customerOrderDates','syncDirtyCustomers','syncState','customerAssignments','monthlyAssignments','targets','branchTargetProgress','businessTargetProgress','targetCoverage','adminInvoiceTargets','adminCis_customers','adminCis_customerCreditProfiles','adminCis_customerIntelligenceSummaries','adminCis_pcBalances','adminCis_customerMonthlySnapshots','adminCis_businessMonthlySnapshots'];
 allow write: if admin() && col in ['customerOrderDates','syncDirtyCustomers','syncState','customerAssignments','monthlyAssignments','targets','branchTargetProgress','businessTargetProgress','targetCoverage','adminInvoiceTargets','adminCis_customers','adminCis_customerCreditProfiles','adminCis_customerIntelligenceSummaries','adminCis_pcBalances','adminCis_customerMonthlySnapshots','adminCis_businessMonthlySnapshots'];
}
match /staffTargetProgress/{id}{allow get: if admin() || (staff() && resource.data.staffId == request.auth.uid);allow list: if bounded() && (admin() || (staff() && resource.data.staffId == request.auth.uid));allow write: if admin();}
// Performance/work summaries are computed from authorized records. Nobody writes counters.
match /{document=**}{allow read, write: if false;}
}}`;
fs.writeFileSync('firestore.spark.rules',rules);
