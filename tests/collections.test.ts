import { describe,it,expect } from "vitest";
import { collectionSchedule,collectionDue } from "../shared/collections";
const invoice={id:"i1",invoiceNumber:"INV-1",customerId:"c1",totalSales:1000,date:"2026-09-01",dueDate:"2026-09-10",bufferDaysAtInvoice:3};
describe("Collection due date plus buffer",()=>{
 it("waits through the last buffer day",()=>{const schedule=collectionSchedule([invoice],[],{},{});expect(collectionDue(schedule,"2026-09-13").amount).toBe(0);expect(collectionDue(schedule,"2026-09-14").amount).toBe(1000);});
 it("counts only remaining allocation after partial payment and discount",()=>{const schedule=collectionSchedule([invoice],[{invoiceId:"i1",amount:900,amountAppliedToInvoice:400,cashDiscount:50}],{},{});expect(collectionDue(schedule,"2026-09-14").amount).toBe(550);});
 it("removes fully settled and cancelled invoices",()=>{expect(collectionSchedule([invoice],[{invoiceId:"i1",amount:1000}],{},{})).toEqual([]);expect(collectionSchedule([{...invoice,status:"cancelled"}],[],{},{})).toEqual([]);});
 it("uses frozen invoice terms before current tier settings",()=>{const rows=collectionSchedule([{...invoice,savedDueDate:"2026-09-12"}],[],{tier:"Tier 1"},{paymentBuffers:{"Tier 1":7}});expect(rows[0].cutoffDate).toBe("2026-09-15");});
 it("uses configured tier buffer for legacy invoices",()=>{const rows=collectionSchedule([{...invoice,bufferDaysAtInvoice:undefined}],[],{tier:"Tier 1"},{paymentBuffers:{"Tier 1":5}});expect(rows[0].cutoffDate).toBe("2026-09-15");});
 it("aggregates only eligible invoices for one customer",()=>{const rows=collectionSchedule([invoice,{...invoice,id:"i2",dueDate:"2026-09-20",totalSales:250}],[],{},{});expect(collectionDue(rows,"2026-09-14").amount).toBe(1000);});
 it("handles month boundaries and zero-day buffers",()=>{const rows=collectionSchedule([{...invoice,dueDate:"2026-09-30",bufferDaysAtInvoice:0}],[],{},{});expect(collectionDue(rows,"2026-09-30").amount).toBe(0);expect(collectionDue(rows,"2026-10-01").amount).toBe(1000);});
});
