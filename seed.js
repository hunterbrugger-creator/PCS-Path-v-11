// PCS Path starter content and demo data.
//
// starter(baseId) returns a ready-made checklist (based on the RAF Mildenhall
// out-processing checklist) that an MPF admin can load for their base and then
// edit. build() creates the demo-mode database: fictional people, with dates
// worked out from today so the demo never goes stale.
(function () {
  'use strict';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dayFromToday(n) { var t = new Date(); return iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n)); }
  function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2); }

  // Offices that sign tasks off. Keys link tasks to offices.
  var OFFICES = {
    tmo: { name: 'TMO', building: 'Bldg 426', phone: '238-5779', hours: '0900-1500 Monday to Friday' },
    medstd: { name: 'Medical Standards', building: 'Lakenheath Hospital, Bldg 926', phone: '226-8202', hours: '0730-1500 Monday to Friday' },
    medrec: { name: 'Medical Records', building: 'Bldg 922, RAF Lakenheath', phone: '226-8742', hours: '0730-1630 Monday to Friday' },
    pass: { name: 'Pass and Registration', building: 'Bldg 440', phone: '238-5501', hours: '0800-1530 Monday to Friday' },
    fin: { name: 'Finance', building: 'Bldg 441', phone: '238-4874', hours: '0900-1500 Monday to Friday' },
    housing: { name: 'Housing Office', building: 'Bldg 460, RAF Lakenheath', phone: '226-2101', hours: '0800-1530 Monday to Friday' },
    mpf: { name: 'MPF Career Development', building: 'Bldg 436, Rm 215', phone: '238-5447', hours: '0800-1500 Monday to Friday' },
    css: { name: 'Squadron CSS', building: 'Bldg 554, Rm 106', phone: '238-5450', hours: '0800-1530 Monday to Friday' }
  };

  // Out-processing. off = days before departure the task is due.
  var OUT = [
    { k: 'o0', off: 120, o: 'mpf', n: 'Complete the vMPF Initial Assignment Briefing', of: 'MPF Career Development', l: 'vMPF, Individual Actions, Assignments', h: '', p: '238-5447', d: 'Complete the Initial Assignment Briefing in vMPF as soon as you receive assignment notification. It opens your virtual out-processing checklist and identifies the documents your MPF requires, such as retainability, medical and dental clearance and, for overseas assignments, family member travel screening. Save a copy of the completed briefing for your records.' },
    { k: 'o1', off: 90, o: 'tmo', tag: 'pov', carry: 1, n: 'TMO personal property and POV', of: 'TMO, HHG and POV', l: 'Bldg 426, next to the Base Library', h: '0900-1500 Monday to Friday', p: '238-5779', d: 'Appointments cannot be made without orders. Complete the PPTY form, Locally Generated Form 75, then send it with your orders to 100lrs.tmo@us.af.mil. Allow 72 business hours for a response. Watch the Outbound Personal Property presentation on the TMO SharePoint before you go.' },
    { k: 'o53', off: 90, tag: 'fam', carry: 1, n: 'Family member medical and educational clearance', of: 'Family Member Relocation Clearance', l: 'Lakenheath Hospital', h: '0800-1600 Monday to Friday', p: '226-8202', d: 'Members with dependents complete the Family Member Travel Screening questionnaire in MyVector after assignment notification. The questionnaire provides immediate clearance or identifies further action. EFMP-enrolled families and those PCSing overseas are directed to Q-base to provide medical and educational information. The AF Form 1466 is no longer used for PCS. Orders may not be valid for dependent travel until clearance is confirmed. Signed off once a final travel determination is issued.' },
    { k: 'o2', off: 60, n: 'TMO passenger travel', of: 'Passenger Travel and CTO', l: 'Bldg 598', h: '0900-1500 Monday to Friday', p: '238-2061', d: 'Start travel using the Automated Passenger Reservation Tool on the Passenger Travel Access Point. Guides for the APRT and the travel process are on the TMO SharePoint. For help email 100lrs.pax@us.af.mil, which cannot accept encrypted mail. You will not be signed out of vMPF until 5 business days before departure.' },
    { k: 'o3', off: 60, tag: 'efmp', n: 'M and FRC EFMP family needs assessment', of: 'EFMP Family Support', l: 'M and FRC, Bldg 460', h: '0800-1630 Monday to Friday', p: '238-3406', d: 'Required for Q-coded Airmen. Family needs assessments go to the gaining installation so support continues without a gap. Schedule after your travel screening clearance is authorised. Contact 100FSS.FSH.EFMP@us.af.mil with your DoD ID. If you are not Q-coded, email the same box to say so and you will be cleared.' },
    { k: 'o4', off: 60, n: 'EZ PCS outbound briefing', of: 'M and FRC', l: 'Bldg 460', h: '0730-1630 Monday to Friday', p: '238-3406', d: 'Attend roughly four months before departure. Covers finance, personal property, vehicle shipment, passenger travel, Tricare and Pass and Registration. Register through the M and FRC events page. If short-notice orders make this impossible, email 100fss.fsfr@us.af.mil with your DoD ID.' },
    { k: 'o5', off: 45, n: 'Mobility gear turn-in', of: 'War Readiness', l: 'Bldg 550', h: '0800-1530 Mon to Fri, 0800-1330 Thu', p: '238-5076', d: 'No appointment needed. You must be within 45 calendar days of final out. Uniform is not required. Remove all SIM M9 and name tapes. Wash the training coat and trousers in mild detergent and cold water, tumble dry low. Report lost or stolen items to the FLI manager and 100LRS.LGRRW@us.af.mil.' },
    { k: 'o6', off: 45, tag: 'cust', n: 'PWCS equipment custodian', of: 'PWCS', l: 'Bldg 585', h: '0730-1600 Monday to Friday', p: '238-2006', d: 'Custodians must submit an appointment letter to the PWCS manager and complete inventory turnover no later than 45 days before departure. Contact 100 CS SCOSA to start turnover. Everyone else is removed automatically.' },
    { k: 'o7', off: 40, tag: 'cust', n: 'Government purchase card', of: '48 CONS GPC', l: 'Bldg 977', h: '0830-1630 Monday to Friday', p: '226-2273', d: 'Cardholders and approving officials contact the GPC team. Approving officials need a cancellation memo before out-processing. A copy of orders is not required. Everyone else is out-processed automatically when they appear in the system.' },
    { k: 'o8', off: 30, tag: 'sipr', n: 'SIPR account and token', of: '100 CS Local Registration Authorities', l: 'Bldg 591', h: '0900-1100 Tuesday to Thursday', p: '238-5728', d: 'If you hold a SIPR token, return it to Bldg 591. You will not be cleared until it is turned in. If you do not hold one, send a digitally signed email to rafmildenhall.lra@us.af.mil or 100CS.SCOSC@us.af.mil to be cleared. You will not appear on the list until 90 days out.' },
    { k: 'o9', off: 30, o: 'mpf', th: 1, n: 'Schedule MPF final-out appointment', of: 'MPF Career Development', l: 'Bldg 436, Rm 215', h: '0800-1500 Monday to Friday', p: '238-5447', d: 'Your CSS signs this off. Uniform is required for the appointment. Get with your CSS to book it no later than 30 calendar days from your projected departure. Print and hand carry every required item on the Team Mildenhall checklist with the CSS signature. Book after you have reserved your flight.' },
    { k: 'o10', off: 30, o: 'medstd', carry: 1, n: 'Medical standards OCONUS', of: '48 AMDS Medical Standards', l: 'Lakenheath Hospital, Bldg 926', h: '0730-1500 Monday to Friday', p: '226-8202', d: 'All personnel PCSing must out-process through Medical Standards. vMPF will not clear earlier than 30 days before departure. Your IMR must be current 90 days past your RNLTD including DRHA and PHA. Email your completed medical clearance memorandum to the BOMC org box with your name, new duty station and DoD ID, subject line vOP PCS. Allow 7 duty days.' },
    { k: 'o55', off: 30, tag: 'pet', n: 'Pet travel and veterinary clearance', of: 'Veterinary Treatment Facility', l: 'Base veterinary clinic', h: '', p: '', d: 'Book the veterinary clinic for an international health certificate inside the window your gaining country requires, often ten days before travel. Check the gaining country import rules for microchip, rabies titer and quarantine on the APHIS pet travel website. Confirm pet space with your airline or the Patriot Express early, it fills fast in summer.' },
    { k: 'o11', off: 30, tag: 'cust', n: 'Unit IT asset management', of: '100 CS SCOSA', l: 'Bldg 586', h: '0730-1630 Monday to Friday', p: '238-8118', d: 'Primary custodians complete a physical inventory and submit an updated appointment letter for turnover no later than 30 days before departure. Contact 100cs.scosa@us.af.mil. Everyone else is removed automatically.' },
    { k: 'o12', off: 30, tag: 'cust', n: 'Equipment custodian and CA/CRL', of: 'Equipment Custodian Out-processing', l: 'Bldg 442, Rm 208', h: '0730-1600 Monday to Friday', p: '238-7008', d: 'Equipment custodians need an updated appointment letter naming your replacement, training certificates for the new custodians, and a signed CA/CRL R-14 reflecting them. COMSEC and SPRAM holders have extra training. Send everything to 100lrs.lgrmceequipment@us.af.mil.' },
    { k: 'o13', off: 30, tag: 'cust', n: 'Bench stock', of: '100 LRS Customer Service', l: 'Bldg 442', h: '0730-1630 Monday to Friday', p: '238-2124', d: 'Email 100LRS.LGRSC2@us.af.mil stating whether you are a bench stock monitor, primary or alternate. If you are, attach an updated appointment letter and training certificates. Complete no later than 30 days before departure. You will not appear on the out-processing list until 60 days out.' },
    { k: 'o14', off: 30, n: 'Voting assistance', of: 'Installation Voting Assistance Office', l: 'M and FRC, Bldg 460', h: '1400-1600 Wednesday to Friday', p: '238-8683', d: 'Notify your local election office you are no longer covered under UOCAVA. You may submit a national mail voter registration form before you separate. Use FVAP.gov for assistance. No visit required, members are removed every Friday from 1400.' },
    { k: 'o15', off: 30, tag: 'cust', n: 'Unit records POC', of: 'Base Records Management', l: 'Bldg 239', h: '0800-1600 Monday to Friday', p: '238-7900', d: 'Records POCs named on a commander-signed appointment letter must be replaced on that letter and complete turnover before leaving. Call 100 CS SCXK to start. Everyone else is signed off automatically.' },
    { k: 'o16', off: 30, tag: 'cust', n: 'Facility manager appointment letter', of: '100 CES CEOER', l: 'Bldg 680, Rm G31', h: '0700-1600 Monday to Friday', p: '238-5655', d: 'Facility managers only. Civil Engineering needs an updated facility manager appointment letter for your area before you depart. Not applicable to anyone else.' },
    { k: 'o54', off: 30, n: 'Narrative-only PRF, AF level students', of: 'MPF Career Development', l: 'Bldg 436, Rm 215', h: '0800-1500 Monday to Friday', p: '238-5447', d: 'Officers assigned as permanent party students training outside their utilization field need a narrative-only PRF, as do certain PPC codes. See AFI 36-2406 paragraph 8.1.5.6.1. Send the PRF to the Career Development org box before your DEROS month and bring it to MPF final out.' },
    { k: 'o17', off: 25, o: 'fin', n: 'Clear finance office', of: '100 CPTS Finance', l: 'Bldg 441', h: '0900-1500 Monday to Friday', p: '238-4874', d: 'Create a ticket in the Comptroller Services Portal when you are within 30 days of departure. Include your orders, any amendments, and your flight itinerary or date of departure. Any deferred security deposit debt must be paid off before vMPF will clear you. Cashier takes payment Tuesdays and Thursdays 0800-1100 by cashiers check, personal check or money order.' },
    { k: 'o20', off: 15, n: 'Clear library', of: 'Base Library', l: 'Bldg 425', h: '1000-1700 Monday to Saturday', p: '238-2352', d: 'If you and your dependents have no library account, or have an account with nothing checked out, no visit is needed. You are signed off automatically once your name appears on vMPF, typically about three weeks before final out. Lost items must be replaced, call to discuss the procedure.' },
    { k: 'o21', off: 15, o: 'css', n: '100 LRS BAS and SIK letter', of: '100 LRS CSS', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-5450', d: 'If you receive BAS or are subsistence in kind, a Form 220 must be completed and turned in so payment stops. The 220 must be signed by the commander, so plan ahead. Checked off at your squadron out-processing appointment.' },
    { k: 'o22', off: 15, o: 'pass', tag: 'pov', n: 'Vehicles and restricted area badge', of: 'Pass and Registration', l: 'Bldg 440', h: '0800-1530 Monday to Friday', p: '238-5501', d: 'Only Pass and ID signs this, not your CSS. Walk-ins 0800-1200, appointments 1300-1530. Complete no later than 3 days before MPF final out. All vehicles must be exported, sold or scrapped first. Bring your restricted area badge with DD Form 2586, driving fuel permit including dependents, proof of vehicle disposal, a copy of orders and your checklist. Do not sell imported vehicles without notifying the office, and never to a British national.' },
    { k: 'o23', off: 15, o: 'housing', n: 'Clear housing office', of: 'Mildenhall Housing Office', l: 'Bldg 460, RAF Lakenheath', h: '0800-1530 Monday to Friday', p: '226-2101', d: 'Off base, give 30 days written notice and get a landlord clearance letter. You can claim your last 10 nights of TLA counting back from departure, including 3 nights overlapping OHA. Base housing, book a pre-inspection 30 to 45 days out and bring your departure date and orders to schedule the final. Dorm residents just provide orders.' },
    { k: 'o24', off: 15, n: 'First sergeant final-out debrief', of: '100 LRS First Sergeant', l: 'Bldg 554, Rm 107', h: '0730-1700 Monday to Friday', p: '238-5473', d: 'Out-process with the first sergeant no later than 5 duty days before departure. Covers quality force review including UIF, PIF and FCP where applicable, and your feedback on squadron operations.' },
    { k: 'o18', off: 14, o: 'fin', n: 'Outstanding TDY orders', of: '100 CPTS FMA', l: 'Bldg 441', h: '0800-1500 Monday to Friday', p: '238-4874', d: 'Go into DTS and make sure every voucher is filed before emailing. Members are out-processed roughly one to two weeks before final out. If you have not been cleared, email 100CPTS.FMA2@us.af.mil.' },
    { k: 'o19', off: 14, n: 'Force protection AT Level 1', of: '100 ARW Antiterrorism Office', l: 'Your unit AT rep', h: '0800-1630 Monday to Friday', p: '238-3455', d: 'Your antiterrorism Level 1 training, course ZZ133079, must be current within the last year. Review the DoD Foreign Clearance Guide for the country you are PCSing to. Send your certificate to 100sfs.s5w@us.af.mil. Sponsors are responsible for family members aged 14 and older completing the briefing before OCONUS travel.' },
    { k: 'o25', off: 10, carry: 1, n: 'Dental records', of: '48 DS Dental Clinic', l: 'Bldg 446, RAF Lakenheath', h: '0730-1700 Mon to Thu, 0730-1630 Fri', p: '226-8010', d: 'Email or bring a copy of your PCS orders within 10 duty days of final out. Emailed orders get you the transfer of dental records memorandum within 48 hours to take to your final out appointment. All dental and medical records are mailed to your gaining treatment facility.' },
    { k: 'o26', off: 10, n: 'Clear furnishings management office', of: 'Furnishing Management Office', l: 'Bldg 73, RAF Feltwell', h: '0830-1530 Mon to Wed, 0930-1530 Thu, 0830-1500 Fri', p: '226-7030', d: 'Every item issued from FMS must be returned before this clears. Call to schedule pick-up of government loaned assets. This one requires a visit, it will not clear on its own.' },
    { k: 'o27', off: 10, o: 'medrec', carry: 1, n: 'Medical records', of: 'Medical Records', l: 'Bldg 922, RAF Lakenheath', h: '0730-1630 Monday to Friday', p: '226-8742', d: 'You must be within 20 days of final out or you will not be cleared. Allow up to 72 hours. Bring 2 copies of orders to the Tricare front desk atrium in Bldg 922 on Tuesday, Wednesday or Thursday between 1000 and 1400.' },
    { k: 'o28', off: 10, tag: 'moto', n: 'Motorcycle safety representative', of: '100 LRS Motorcycle Safety Rep', l: 'Bldg 426 or 554', h: '0800-1500 Monday to Friday', p: '238-1128', d: 'All riders must be cleared from MUSTT. If you are PCSing, transfer your MUSTT profile to the gaining base. Non-riders are removed automatically. Cleared at your squadron final out.' },
    { k: 'o29', off: 10, tag: 'air', n: 'HARM records', of: 'HARM Records', l: 'Bldg 809', h: '0800-1630 Monday to Friday', p: '238-6955', d: 'Only flyers and jumpers. Out-process your SARM office first, then email a copy of your orders to 100OSS.OSOF@us.af.mil. Jumpers must contact HARM for jump record pick-up between 0830 and 1530. Non-aircrew are removed automatically.' },
    { k: 'o30', off: 10, n: 'Out-process education office', of: 'Education Office', l: 'Bldg 427, Washington Square', h: '0800-1600 Monday to Friday', p: '238-2350', d: 'Handled through vMPF. Your education records are locked and stay inaccessible until you in-process at your next base. If vMPF shows visit required, report to the education services office in person.' },
    { k: 'o31', off: 10, n: 'Immunizations clinic', of: 'Immunizations Clinic', l: 'Bldg 932, RAF Lakenheath', h: '0730-1630 Monday to Friday', p: '226-8203', d: 'If you need no immunizations you are signed out automatically within 10 days of the suspense date. Otherwise send your clearance memorandum to the SGOMA org box, filled out properly and named with your rank and full name.' },
    { k: 'o32', off: 7, n: 'Post office', of: 'Post Office', l: 'Bldg 442', h: '0900-1600 Monday to Friday', p: '238-7671', d: 'Bring or email a copy of your orders and the RAFM worksheet from the post office website. Bring key fobs to the customer service window. Make sure you have a complete forwarding address before out-processing.' },
    { k: 'o33', off: 5, n: 'UDM and force protection', of: '100 LRS UDM', l: 'Bldg 550, Rm 111', h: '0800-1600 Monday to Friday', p: '238-6686', d: 'Stop by the unit deployment office no earlier than 5 days before final out. The UDM office checks this off.' },
    { k: 'o34', off: 5, n: 'Government drivers licence', of: 'Operations Resources and Logistics', l: 'Bldg 582', h: '0730-1630 Monday to Friday', p: '238-2442', d: 'If you hold a government licence you must out-process with OR and L to get your DAF Form 2296 master driver record transferred, or the gaining base cannot accept you. vMPF will not clear earlier than 30 days out. If you were never issued one, no action needed.' },
    { k: 'o35', off: 3, tag: 'dorm', n: 'Unaccompanied housing, dorms', of: 'Unaccompanied Housing', l: 'Dorm managers office', h: '0730-1600 Monday to Friday', p: '238-5736', d: 'Dorm residents schedule a pre-inspection and final inspection no later than 30 days before departure. You are signed off after the final inspection. Non-residents are signed off automatically 30 days out.' },
    { k: 'o36', off: 3, n: 'Ration card turn-in', of: '100 FSS Customer Service', l: 'Bldg 436', h: '0800-1500 Monday to Friday', p: '238-2276', d: 'Turn in your ration card no earlier than 3 days before final out, to the CSS office that issued it since they account for the controlled item. If the card is lost you need a lost ration card letter signed by your first sergeant or commander.' },
    { k: 'o37', off: 1, n: 'CRO clearance', of: '100 LRS Flight Admin', l: 'Bldg 554', h: '0800-1530 Monday to Friday', p: '238-0000', d: 'Meet flight admin to process any CRO requests. They update the duty status change request spreadsheet with any changes. Ask admin to wet sign a paper copy of the checklist and bring it to final out with your CSS.' },
    { k: 'o38', off: 1, o: 'css', n: '100 LRS CSS final out', of: '100 LRS CSS', l: 'Bldg 554, Rm 106', h: '0830-1630 Monday to Thursday', p: '238-6454', d: 'Send your flight itinerary and orders to 100lrs.css@us.af.mil. You get a calendar invite with your squadron and MPF final out dates and times, with the MPF document checklist attached. Bring that checklist and the documents to your squadron final out.' },
    { k: 'o39', off: 1, n: 'Government travel card verification', of: '100 LRS APC', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-5465', d: 'The APC verifies PCS status on your GTCC. PCS status and the increased limit should activate automatically no later than 15 days before DEROS and can be confirmed in Citibank. Checked off at squadron final out.' },
    { k: 'o40', off: 1, n: 'Sponsorship handover', of: '100 LRS Sponsorship Program', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-2911', d: 'Contact flight admin to reassign any inbound members you are sponsoring. Have flight admin wet sign a copy of the checklist. Signed off at squadron final out.' },
    { k: 'o41', off: 1, n: 'DTS detach', of: '100 LRS ODTA', l: 'Bldg 554, Rm 106', h: '0830-1600 Monday to Friday', p: '238-5465', d: 'The ODTA detaches you from 100 LRS in DTS. Make sure there are no active authorizations or vouchers left open. Cleared at squadron final out.' },
    { k: 'o42', off: 1, n: 'Return building and section keys', of: '100 LRS Facility Manager', l: 'Bldg 554, Rm 111', h: '0800-1530 Monday to Friday', p: '238-6379', d: 'Return any building or section keys to the facility manager and have them wet sign a copy of the checklist. Cleared at final out with your CSS.' },
    { k: 'o43', off: 1, o: 'css', n: 'Quality indicator clearance', of: '100 LRS CSS', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-5450', d: 'If you have a UIF it is mailed to your next duty location. Cleared at your squadron final out appointment.' },
    { k: 'o44', off: 1, n: 'Unit training manager', of: '100 LRS UTM', l: 'Bldg 554, Rm 204', h: '0800-1500 Monday to Friday', p: '238-5786', d: 'Visit the 100 LRS UTM for final out clearance. Take a paper copy of the checklist to be wet signed. Cleared at final out with your CSS.' },
    { k: 'o45', off: 1, o: 'css', n: 'EPB and OPB status', of: '100 LRS CSS', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-5450', d: 'Be aware of your current performance brief status before you leave. Checked off at final out with your CSS.' },
    { k: 'o46', off: 0, n: 'Fitness record verification', of: '100 LRS Fitness Monitor', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-6454', d: 'Verify your last and upcoming PT test and body composition assessment with the 100 LRS fitness monitor at final out with your CSS.' },
    { k: 'o47', off: 0, n: 'Client systems administrator', of: '100 LRS CSA', l: 'Bldg 554', h: '0800-1600 Monday to Friday', p: '238-5463', d: 'The CSA deletes your network account. Return any IT assets. Take a paper copy of the checklist to the CSA for a wet signature. Cleared at final out with your CSS.' },
    { k: 'o48', off: 0, n: 'Flight final out', of: '100 LRS Flight Leadership', l: 'Varies by flight', h: '0800-1600 Monday to Friday', p: '238-0000', d: 'See your flight admin to make a final out appointment with flight leadership. Take a paper copy of the checklist for a wet signature. Cleared at final out with your CSS.' },
    { k: 'o49', off: 0, n: 'Senior enlisted leader final out', of: '100 LRS SEL', l: 'Bldg 554, Rm 108', h: '0800-1530 Monday to Friday', p: '238-7224', d: 'Meet with the 100 LRS SEL and bring a paper copy of the checklist for a wet signature. Cleared at final out with your CSS.' },
    { k: 'o50', off: 0, o: 'css', n: 'Security manager', of: '100 LRS Security Manager', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-6454', d: 'You complete IMT 2587 for security release during your final out appointment with the CSS.' },
    { k: 'o51', off: 0, o: 'css', n: 'Stop special duty assignment pay', of: '100 LRS CSS', l: 'Bldg 554, Rm 106', h: '0800-1530 Monday to Friday', p: '238-2911', d: 'If you receive SDAP you must complete a Form 2096 to stop it before departing. Email 100lrs.css@us.af.mil to request the 2096 no later than 15 duty days before squadron final out.' },
    { k: 'o52', off: 0, n: 'Reports and analysis', of: 'Reports and Analysis', l: 'Bldg 438', h: '0600-1600 Monday to Friday', p: '238-5512', d: 'Email a copy of your orders, your final out date, and the SSNs of any dependents aged 10 and over to 100SFS.S5.RA@us.af.mil. Orders are still required even if you have no dependents.' }
  ];

  // In-processing. off = days after RNLTD the task is due.
  var IN = [
    { k: 'i101', off: 0, n: 'Report to unit', of: 'Your unit', l: 'Squadron orderly room', h: 'Duty hours', p: '', d: 'Your first stop. Check in with your orderly room or first sergeant. Many other offices need proof of unit check-in before they will see you, so do this on day one.' },
    { k: 'i102', off: 0, o: 'pass', n: 'Base pass and ID card', of: 'Pass and Registration', l: 'Pass and ID office', h: '0800-1530 Monday to Friday', p: '', d: 'Get your base access credential and update your CAC with the new duty location. Bring your orders and current ID.' },
    { k: 'i103', off: 3, o: 'fin', n: 'Finance in-processing', of: 'Finance', l: 'Finance office', h: '0800-1500 Monday to Friday', p: '', d: 'Set up pay for the new location including COLA, OHA and overseas entitlements. Bring orders, a recent LES, your lease if you have one, and bank details.' },
    { k: 'i104', off: 7, o: 'medrec', carry: 1, n: 'Medical records transfer in', of: 'Medical Records', l: 'Medical group', h: '0730-1630 Monday to Friday', p: '', d: 'Hand over the records you carried from your last base and enroll with a local primary care team. Bring records for every family member.' },
    { k: 'i105', off: 7, o: 'housing', n: 'Housing in-brief', of: 'Housing Office', l: 'Housing office', h: '0800-1530 Monday to Friday', p: '', d: 'Mandatory briefing covering on-base availability, off-base rules and your housing entitlement. Appointment required, book before you arrive if you can.' },
    { k: 'i106', off: 14, country: 'Germany', n: 'USAREUR drivers licence', of: 'Vehicle Registration', l: 'Vehicle registration office', h: '0800-1530 Monday to Friday', p: '', d: 'Germany requires the USAREUR licence and your US licence alone is not valid. A written test is required. Bring your US licence, orders and proof of insurance.' },
    { k: 'i107', off: 14, country: 'Germany', n: 'NATO SOFA customs card', of: 'Customs Office', l: 'Customs office', h: '0800-1600 Monday to Friday', p: '', d: 'Issued for duty-free purchases and customs clearance in Germany. Bring your orders and ID.' },
    { k: 'i110', off: 14, country: 'UK', n: 'UK driving permit and vehicle registration', of: 'Pass and Registration', l: 'Pass and ID office', h: '0800-1530 Monday to Friday', p: '', d: 'Register any vehicle you bring and confirm what licence you need to drive in the UK. Bring your US licence, orders, proof of insurance and vehicle documents.' },
    { k: 'i111', off: 3, n: 'Update vRED, SGLI and AFPAAS', of: 'Your unit', l: 'AF Portal, vMPF', h: '', p: '', d: 'Within 72 hours of arrival, update your Record of Emergency Data (vRED), confirm your SGLI beneficiaries and update your location and contact information in AFPAAS. Your orderly room may ask for confirmation.' },
    { k: 'i112', off: 5, o: 'fin', n: 'File your PCS travel voucher', of: 'Finance', l: 'DTS or DD Form 1351-2', h: '0800-1500 Monday to Friday', p: '', d: 'Submit your PCS travel claim within five business days of arrival, or as directed by the finance office. Include your orders and amendments, lodging receipts, and any TLE or TLA documentation. Claim dislocation allowance if you have not already received it.' },
    { k: 'i108', off: 30, n: 'Newcomer orientation brief', of: 'Airman and Family Readiness', l: 'A and FRC', h: '0730-1630 Monday to Friday', p: '', d: 'Base-wide orientation covering local laws, driving, host nation customs and available services. Offered regularly, sign up through your sponsor.' },
    { k: 'i109', off: 30, n: 'Commander in-processing', of: 'Squadron leadership', l: 'Squadron', h: 'Duty hours', p: '', d: 'Final sign-off. Your commander confirms in-processing is complete and you are released to full duty status.' }
  ];

  var RULES = [
    ['day1', 'Day one nudge', 'Sent when out-processing opens, pointing at the task with the longest lead time'],
    ['thirty', 'Thirty days out', 'Summary of everything still open with 30 days to go'],
    ['three', 'Three days before a due date', 'Per-task reminder with what to bring'],
    ['overdue', 'Overdue alert', 'Sent when a task passes its due date'],
    ['arrival', 'Arrival week', 'Sent on RNLTD with the first three in-processing stops']
  ];

  var BASE_TIPS = [
    { tier: 'mpf', label: 'Base MPF', applies: 'out', title: 'Initiate household goods action upon receipt of orders', body: 'Shipment dates fill quickly during the summer moving season. Submit the PPTY Form 75 and your orders to TMO as early as possible. Household goods moves are scheduled through the Defense Personal Property System (DPS) at move.mil.' },
    { tier: 'mpf', label: 'Base MPF', applies: 'both', title: 'Retain multiple copies of your orders', body: 'Most offices require a copy of your orders and any amendments. Maintain at least ten printed copies and an electronic copy on your phone.' },
    { tier: 'mpf', label: 'Base MPF', applies: 'out', title: 'Several items are cleared at squadron final out', body: 'CRO, GTCC, DTS, keys, UTM, fitness, CSA, SEL, security manager and SDAP are cleared at the same CSS appointment. Bring one wet-signed paper checklist to that appointment.' },
    { tier: 'mpf', label: 'Base MPF', applies: 'out', title: 'Advance pay and dislocation allowance', body: 'If you require funds for the move, request advance pay (DD Form 2560) and dislocation allowance through the finance office before departure. Advance pay is repaid through pay deductions. Consult finance before requesting it.' },
    { tier: 'mpf', label: 'Base MPF', applies: 'in', title: 'Temporary lodging entitlements differ by location', body: 'Temporary Lodging Expense (TLE) applies in CONUS and is claimed on your travel voucher. Temporary Lodging Allowance (TLA) applies overseas and is paid through military pay. Retain all lodging receipts.' },
    { tier: 'mpf', label: 'Base MPF', applies: 'in', title: 'Inspect household goods at delivery', body: 'Note any missing or damaged items on the delivery inventory before signing, photograph the damage and report it in DPS. Confirm the current claim deadline with your Transportation Office, as it has changed recently.' },
    { tier: 'office', label: 'Medical Standards', applies: 'out', title: 'Your IMR must remain current 90 days beyond your RNLTD', body: 'This includes the DRHA and PHA. Verify your IMR before submitting the clearance memorandum, or it will be returned.' },
    { tier: 'office', label: 'Medical Records', applies: 'out', title: 'Medical records cannot be cleared early', body: 'You must be within 20 days of final out to be cleared. Bring two copies of your orders to the Tricare atrium on Tuesday, Wednesday or Thursday between 1000 and 1400.' },
    { tier: 'counsel', label: 'Base counselor', applies: 'out', title: 'Dispose of vehicles before visiting Pass and Registration', body: 'Pass and Registration cannot clear you until every vehicle is removed from your record. Schedule a separate, earlier visit to obtain export forms.' }
  ];
  var GLOBAL_TIPS = [
    { tier: 'global', label: 'Global', applies: 'out', title: 'Apply for no-fee passports immediately', body: 'No-fee passports for official travel can take several weeks. Apply through the MPF upon receipt of orders rather than waiting for travel to be booked.' }
  ];

  // A ready-made checklist for one base. prefix gives readable ids (demo only).
  function starter(baseId, opts) {
    opts = opts || {};
    var id = opts.prefix ? function (k) { return opts.prefix + '-' + k; } : function () { return uuid(); };
    var officeIds = {}, offices = [];
    Object.keys(OFFICES).forEach(function (k) {
      if (opts.existingOffices && opts.existingOffices[OFFICES[k].name]) { officeIds[k] = opts.existingOffices[OFFICES[k].name]; return; }
      officeIds[k] = id('off-' + k);
      offices.push(Object.assign({ id: officeIds[k], base_id: baseId, status: 'Open' }, OFFICES[k]));
    });
    function row(t, dir, i) {
      return {
        id: id(t.k), base_id: baseId, dir: dir, name: t.n, descr: t.d, office_name: t.of, loc: t.l,
        hours: t.h || null, phone: t.p || null, office_id: t.o ? officeIds[t.o] : null,
        offset_days: t.off, tag: t.tag || null, carry: !!t.carry, triggers_handoff: !!t.th, sort: i
      };
    }
    var tasks = [];
    if (!opts.inOnly) OUT.forEach(function (t, i) { tasks.push(row(t, 'out', i)); });
    IN.forEach(function (t, i) {
      if (t.country && t.country !== opts.country) return;
      tasks.push(row(t, 'in', 100 + i));
    });
    var rules = RULES.map(function (r) { return { id: id('rule-' + r[0]), base_id: baseId, rule_key: r[0], title: r[1], body: r[2], enabled: true }; });
    var tips = BASE_TIPS.map(function (t, i) { return Object.assign({ id: id('tip-' + i), base_id: baseId, author_id: opts.author || null, created_at: new Date().toISOString() }, t); });
    return { offices: offices, tasks: tasks, rules: rules, tips: tips };
  }

  // ------------------------------------------------------------------
  // Demo database
  // ------------------------------------------------------------------
  var DEMO_ACCOUNTS = [
    { email: 'carter@us.af.mil', n: 'SSgt Carter', d: 'Member only, mid-PCS', i: 'ti-user-circle', c: '#1A5FA8' },
    { email: 'webb@us.af.mil', n: 'SSgt Webb', d: 'Office worker who is also PCSing', i: 'ti-users', c: '#3C6E12' },
    { email: 'alvarez@us.af.mil', n: 'TSgt Alvarez', d: 'Sponsor and office lead', i: 'ti-friends', c: '#8A4B10' },
    { email: 'chen@us.af.mil', n: 'MSgt Chen', d: 'Base MPF super admin', i: 'ti-building', c: '#3C6E12' },
    { email: 'davis@us.af.mil', n: 'MSgt Davis', d: 'Counselor, squadron CSS and commander', i: 'ti-user-check', c: '#0D4680' },
    { email: 'reed@us.af.mil', n: 'Mr Reed', d: 'Global admin', i: 'ti-shield-lock', c: '#554CBB' },
    { email: 'nguyen@us.af.mil', n: 'Capt Nguyen', d: 'New profile awaiting MPF review', i: 'ti-clock', c: '#7A4809' }
  ];

  function build() {
    var T = dayFromToday;
    var now = new Date();
    function ts(daysAgo, h, m) { var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, h || 9, m || 0); return d.toISOString(); }
    var db = { version: 6, auth: [], bases: [], offices: [], profiles: [], tasks: [], task_progress: [], tips: [], messages: [], notifications: [], appt_requests: [], slots: [], role_requests: [], reminder_rules: [], sponsor_prep: [] };

    db.bases = [
      { id: 'mildenhall', name: 'RAF Mildenhall', country: 'UK', live: true },
      { id: 'ramstein', name: 'Ramstein AB', country: 'Germany', live: true },
      { id: 'kadena', name: 'Kadena AB', country: 'Japan', live: true },
      { id: 'osan', name: 'Osan AB', country: 'South Korea', live: true },
      { id: 'aviano', name: 'Aviano AB', country: 'Italy', live: true },
      { id: 'travis', name: 'Travis AFB', country: 'CONUS', live: false },
      { id: 'yokota', name: 'Yokota AB', country: 'Japan', live: false }
    ];
    var mil = starter('mildenhall', { prefix: 'mil', country: 'UK' });
    var ram = starter('ramstein', { prefix: 'ram', country: 'Germany', inOnly: true });
    db.offices = mil.offices.concat(ram.offices);
    db.tasks = mil.tasks.concat(ram.tasks).concat([
      { id: 'sq-o1', base_id: 'mildenhall', dir: 'out', unit: '100 LRS', name: '100 LRS squadron out-processing brief', descr: 'Attend the squadron out-processing brief with the 100 LRS CSS. Bring your orders and a printed checklist. Covers squadron final out, equipment turn-in and the sponsorship hand-over.', office_name: '100 LRS CSS', loc: 'Bldg 554, Rm 106', hours: '0800-1530 Monday to Friday', phone: '238-5450', office_id: null, offset_days: 20, tag: null, carry: false, triggers_handoff: false, sort: 900 },
      { id: 'sq-i1', base_id: 'mildenhall', dir: 'in', unit: '100 LRS', name: '100 LRS newcomer squadron brief', descr: 'Report to the 100 LRS CSS for the squadron newcomer brief, section assignment and introduction to squadron leadership.', office_name: '100 LRS CSS', loc: 'Bldg 554, Rm 106', hours: '0800-1530 Monday to Friday', phone: '238-5450', office_id: null, offset_days: 2, tag: null, carry: false, triggers_handoff: false, sort: 901 }
    ]);
    db.reminder_rules = mil.rules.concat(ram.rules);
    db.tips = mil.tips.concat(GLOBAL_TIPS.map(function (t, i) { return Object.assign({ id: 'glob-tip-' + i, base_id: null, author_id: null, created_at: ts(30) }, t); }));

    var MEDREC = 'mil-off-medrec';
    function P(o) {
      return Object.assign({
        email: '', unit: '100 LRS', base_id: 'mildenhall', roles: ['member'], status: 'active', office_id: null,
        dir: 'out', gaining_base: null, depart: null, rnltd: null, move_type: 'OCONUS to OCONUS', flags: {}, docs: {},
        sponsor_id: null, handoff: 'pending', return_note: null, created_at: ts(40)
      }, o);
    }
    db.profiles = [
      P({ id: 'u-carter', email: 'carter@us.af.mil', name: 'SSgt Carter, James', gaining_base: 'ramstein', depart: T(33), rnltd: T(49), sponsor_id: 'u-alvarez', flags: { fam: true, efmp: true, pov: true, pet: true, sipr: true, cust: true }, docs: { orders: true } }),
      P({ id: 'u-webb', email: 'webb@us.af.mil', name: 'SSgt Webb, Sarah', unit: '48 AMDS', roles: ['member', 'worker'], office_id: MEDREC, gaining_base: 'travis', depart: T(60), rnltd: T(75), move_type: 'OCONUS to CONUS', flags: { cust: true, moto: true } }),
      P({ id: 'u-alvarez', email: 'alvarez@us.af.mil', name: 'TSgt Alvarez, Marco', roles: ['sponsor', 'lead'], office_id: MEDREC }),
      P({ id: 'u-chen', email: 'chen@us.af.mil', name: 'MSgt Chen, Linda', unit: '100 FSS', roles: ['mpf'] }),
      P({ id: 'u-davis', email: 'davis@us.af.mil', name: 'MSgt Davis, Robert', roles: ['counsel', 'css', 'cmd'] }),
      P({ id: 'u-reed', email: 'reed@us.af.mil', name: 'Mr Reed, Alan', unit: 'HQ AFPC', base_id: null, roles: ['global'] }),
      P({ id: 'u-nguyen', email: 'nguyen@us.af.mil', name: 'Capt Nguyen, David', unit: '100 MXS', status: 'pending', gaining_base: 'osan', depart: T(70), rnltd: T(84), flags: { fam: true, sipr: true }, created_at: ts(1) }),
      P({ id: 'u-kim', name: 'A1C Kim, Jae', gaining_base: 'kadena', depart: T(37), rnltd: T(52) }),
      P({ id: 'u-reyes', name: 'SrA Reyes, Priya', gaining_base: 'aviano', depart: T(42), rnltd: T(56), flags: { cust: true } }),
      P({ id: 'u-walker', name: 'SSgt Walker, Tom', gaining_base: 'ramstein', depart: T(51), rnltd: T(66), flags: { fam: true, pov: true } }),
      P({ id: 'u-doyle', name: 'SSgt Doyle, Sam', roles: ['sponsor'], dir: 'none' }),
      P({ id: 'u-morris', name: 'TSgt Morris, Kelly', base_id: 'kadena', unit: '100 ARW', gaining_base: 'mildenhall', depart: T(-12), rnltd: T(-4), handoff: 'complete', sponsor_id: 'u-doyle' }),
      P({ id: 'u-lee', name: 'A1C Lee, Ben', base_id: 'travis', unit: '60 LRS', gaining_unit: '100 LRS', gaining_base: 'mildenhall', depart: T(4), rnltd: T(12), move_type: 'CONUS to OCONUS', handoff: 'complete' }),
      P({ id: 'u-park', name: 'SSgt Park, Hana', base_id: 'aviano', unit: '100 MXS', gaining_base: 'mildenhall', depart: T(20), rnltd: T(30) }),
      P({ id: 'u-green', name: 'MSgt Green, Tara', base_id: 'yokota', unit: '374 FSS' })
    ];
    DEMO_ACCOUNTS.forEach(function (a) {
      var p = db.profiles.find(function (x) { return x.email === a.email; });
      db.auth.push({ id: p.id, email: a.email, pass: 'demo' });
    });

    function done(member, keys, signed) {
      keys.forEach(function (k) {
        db.task_progress.push({ member_id: member, task_id: 'mil-' + k, status: 'done', signed_by: null, signed_name: signed || 'Signed off', updated_at: ts(5) });
      });
    }
    function mark(member, k, status, signed) { db.task_progress.push({ member_id: member, task_id: 'mil-' + k, status: status, signed_by: null, signed_name: signed || null, updated_at: ts(1) }); }
    // Carter: well along, two items overdue, three due in three days.
    done('u-carter', ['o0'], 'MPF Career Development');
    done('u-carter', ['o53'], 'Final travel determination');
    done('u-carter', ['o3'], 'EFMP-FS');
    done('u-carter', ['o4'], 'M and FRC');
    done('u-carter', ['o5'], 'War Readiness');
    done('u-carter', ['o6', 'o11'], '100 CS');
    done('u-carter', ['o7'], '48 CONS');
    done('u-carter', ['o12', 'o13'], '100 LRS');
    done('u-carter', ['o14'], 'IVAO');
    done('u-carter', ['o15'], 'Records Mgmt');
    done('u-carter', ['o16'], '100 CES');
    done('u-carter', ['o17', 'o18'], '100 CPTS');
    done('u-carter', ['o19'], 'AT Office');
    done('u-carter', ['o20'], 'Library');
    done('u-carter', ['o30'], 'Education');
    done('u-carter', ['o31'], 'Immunizations');
    mark('u-carter', 'o54', 'na', 'Not applicable');
    mark('u-carter', 'o2', 'submitted');
    // Other members at different stages.
    var byOff = function (min) { return mil.tasks.filter(function (t) { return t.dir === 'out' && !t.tag && t.offset_days >= min; }).map(function (t) { return t.id.replace('mil-', ''); }); };
    done('u-kim', byOff(25).filter(function (k) { return k !== 'o2'; }), 'Signed off');
    mark('u-kim', 'o27', 'submitted');
    done('u-reyes', byOff(14), 'Signed off');
    done('u-walker', byOff(60).concat(['o10']), 'Signed off');
    done('u-webb', byOff(60), 'Signed off');
    done('u-morris', ['i101', 'i102'], 'Signed off');

    db.notifications = [
      { id: 'n-1', user_id: 'u-carter', kind: 'system', title: 'Your profile is approved', body: 'Your checklist at RAF Mildenhall is live. Start with TMO, it has the longest lead time.', is_read: true, dedupe_key: 'approved', created_at: ts(20) },
      { id: 'n-2', user_id: 'u-carter', kind: 'system', title: 'Meet your sponsor, TSgt Alvarez', body: 'Your sponsor can see your arrival date and helps you get set up at Ramstein AB. Say hello in Inbox, Sponsor.', is_read: true, dedupe_key: 'sponsor-intro', created_at: ts(3) },
      { id: 'n-3', user_id: 'u-carter', kind: 'message', title: 'New message from TSgt Alvarez, Marco', body: 'Dog is fine, just make sure the health certificate is inside ten days of travel.', is_read: false, dedupe_key: null, created_at: ts(0, 9, 40) }
    ];
    db.messages = [
      { id: 'm-1', member_id: 'u-carter', sender_id: 'u-alvarez', body: 'Got your assignment notification. I put you on the temporary lodging list already. What is your rough arrival window?', created_at: ts(0, 9, 14) },
      { id: 'm-2', member_id: 'u-carter', sender_id: 'u-carter', body: 'Appreciate it. Landing around my RNLTD, wife and one kid, plus a dog.', created_at: ts(0, 9, 31) },
      { id: 'm-3', member_id: 'u-carter', sender_id: 'u-alvarez', body: 'Dog is fine, just make sure the health certificate is inside ten days of travel. On-base housing wait is about six weeks so plan on lodging.', created_at: ts(0, 9, 40) }
    ];
    db.sponsor_prep = [
      { id: 'sp-1', member_id: 'u-carter', title: 'Confirm temporary lodging booking', body: 'Six week housing wait means they will need lodging on arrival', done: true, created_at: ts(3) },
      { id: 'sp-2', member_id: 'u-carter', title: 'Send local area guide and school information', body: 'One dependent aged 8, include the DoDEA elementary catchment', done: true, created_at: ts(3) },
      { id: 'sp-3', member_id: 'u-carter', title: 'Arrange airport pickup', body: 'Frankfurt is about ninety minutes out, confirm flight details', done: false, created_at: ts(3) },
      { id: 'sp-4', member_id: 'u-carter', title: 'Reserve loan closet items', body: 'Basic kitchen and bedding until household goods arrive', done: false, created_at: ts(3) },
      { id: 'sp-5', member_id: 'u-carter', title: 'Introduce to section supervisor before arrival', body: 'A quick call ahead of day one helps more than anything else', done: false, created_at: ts(3) }
    ];
    // Appointments: two confirmed, two waiting for the office, and lunch blocked.
    function weekday(n) { var d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); var c = 0; while (c < n) { d.setDate(d.getDate() + 1); if (d.getDay() > 0 && d.getDay() < 6) c++; } return iso(d); }
    var HOUSING = 'mil-off-housing';
    db.slots = [
      { id: 'slot-1', office_id: MEDREC, slot_day: weekday(1), slot_time: '09:00', member_id: 'u-walker', blocked: false },
      { id: 'slot-2', office_id: MEDREC, slot_day: weekday(2), slot_time: '13:30', member_id: 'u-reyes', blocked: false },
      { id: 'slot-3', office_id: MEDREC, slot_day: weekday(1), slot_time: '10:00', member_id: 'u-carter', blocked: false },
      { id: 'slot-4', office_id: HOUSING, slot_day: weekday(3), slot_time: '11:00', member_id: 'u-kim', blocked: false },
      { id: 'slot-5', office_id: MEDREC, slot_day: weekday(2), slot_time: '12:00', member_id: null, blocked: true },
      { id: 'slot-6', office_id: MEDREC, slot_day: weekday(2), slot_time: '12:30', member_id: null, blocked: true }
    ];
    db.appt_requests = [
      { id: 'ar-1', member_id: 'u-walker', task_id: 'mil-o27', office_id: MEDREC, note: '', status: 'confirmed', slot_id: 'slot-1', created_at: ts(3) },
      { id: 'ar-2', member_id: 'u-reyes', task_id: 'mil-o27', office_id: MEDREC, note: '', status: 'confirmed', slot_id: 'slot-2', created_at: ts(2) },
      { id: 'ar-3', member_id: 'u-carter', task_id: 'mil-o27', office_id: MEDREC, note: '', status: 'pending', slot_id: 'slot-3', created_at: ts(0, 8, 5) },
      { id: 'ar-4', member_id: 'u-kim', task_id: 'mil-o23', office_id: HOUSING, note: '', status: 'pending', slot_id: 'slot-4', created_at: ts(0, 7, 50) }
    ];
    db.notifications.push(
      { id: 'n-4', user_id: 'u-webb', kind: 'appt', title: 'Appointment request: SSgt Carter, James', body: 'Medical records, ' + weekday(1) + ' 1000. Confirm or reject it under Appts.', is_read: false, dedupe_key: null, created_at: ts(0, 8, 5) },
      { id: 'n-5', user_id: 'u-alvarez', kind: 'appt', title: 'Appointment request: SSgt Carter, James', body: 'Medical records, ' + weekday(1) + ' 1000. Confirm or reject it under Appts.', is_read: false, dedupe_key: null, created_at: ts(0, 8, 5) },
      { id: 'n-6', user_id: 'u-chen', kind: 'appt', title: 'Appointment request: A1C Kim, Jae', body: 'Clear housing office at Housing Office. Nobody is linked to that office, so confirm or reject it under Appts.', is_read: false, dedupe_key: null, created_at: ts(0, 7, 50) },
      { id: 'n-7', user_id: 'u-reed', kind: 'system', title: 'New help request from SSgt Carter, James', body: 'The Upload a file button on Medical records does not open my photos on my iPhone.', is_read: false, dedupe_key: null, created_at: ts(0, 11, 20) },
      { id: 'n-8', user_id: 'u-reed', kind: 'system', title: 'New help request from A1C Lopez, Maria', body: 'I asked for a password reset twice but the email never came.', is_read: false, dedupe_key: null, created_at: ts(0, 12, 2) }
    );

    // Sample blank forms on tasks, and a file a member uploaded.
    db.files = {};
    function samplePdf(title, lines) {
      var text = ['BT /F1 18 Tf 60 740 Td (' + title + ') Tj ET'].concat(lines.map(function (l, i) { return 'BT /F1 11 Tf 60 ' + (705 - i * 18) + ' Td (' + l + ') Tj ET'; })).join('\n');
      var objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length ' + text.length + ' >>\nstream\n' + text + '\nendstream'];
      var out = '%PDF-1.4\n', offs = [];
      objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
      var x = out.length;
      out += 'xref\n0 6\n0000000000 65535 f \n' + offs.map(function (o) { return ('000000000' + o).slice(-10) + ' 00000 n \n'; }).join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF';
      return { url: 'data:application/pdf;base64,' + btoa(out), size: out.length };
    }
    function addForm(id, taskId, name, lines) {
      var pdf = samplePdf(name, lines), path = 'mildenhall/' + taskId + '/' + id + '-' + name.replace(/[^A-Za-z0-9._-]+/g, '_');
      db.files['forms/' + path] = pdf.url;
      db.task_files.push({ id: id, task_id: taskId, name: name, path: path, size: pdf.size, uploaded_by: 'u-chen', created_at: ts(6) });
    }
    db.task_files = [];
    addForm('tf-1', 'mil-o1', 'PPTY Form 75 (sample).pdf', ['Sample form for the PCS Path demo.', 'Name, rank, DoD ID: ______________________', 'Pickup date requested: __________________', 'Send with your orders to the TMO org box.']);
    addForm('tf-2', 'mil-o38', 'Out-processing checklist (sample).pdf', ['Sample checklist for the PCS Path demo.', 'Bring this to squadron final out for wet signatures.', 'CSS ____   UTM ____   CSA ____   SEL ____']);
    var orders = samplePdf('PCS orders (sample)', ['Demo file uploaded by A1C Kim.', 'Real uploads appear here for the office that signs the task off.']);
    db.files['uploads/u-kim/mil-o27/mf-1-PCS_orders_sample.pdf'] = orders.url;
    db.member_files = [{ id: 'mf-1', member_id: 'u-kim', task_id: 'mil-o27', name: 'PCS orders (sample).pdf', path: 'u-kim/mil-o27/mf-1-PCS_orders_sample.pdf', size: orders.size, created_at: ts(1) }];

    // Help and feedback messages for the global admin's Support tab.
    db.support_tickets = [
      { id: 'st-1', user_id: 'u-carter', email: 'carter@us.af.mil', name: 'SSgt Carter, James', base_id: 'mildenhall', kind: 'bug', message: 'The Upload a file button on Medical records does not open my photos on my iPhone.', context: 'Member · screen: member · PCS Path v15 · iPhone Safari', attachment_path: null, attachment_name: null, status: 'new', reply: null, replied_at: null, created_at: ts(0, 11, 20) },
      { id: 'st-2', user_id: null, email: 'maria.lopez@us.af.mil', name: 'A1C Lopez, Maria', base_id: null, kind: 'account', message: 'I asked for a password reset twice but the email never came.', context: 'Signed out · screen: login · PCS Path v15', attachment_path: null, attachment_name: null, status: 'new', reply: null, replied_at: null, created_at: ts(0, 12, 2) },
      { id: 'st-3', user_id: 'u-webb', email: 'webb@us.af.mil', name: 'SSgt Webb, Sarah', base_id: 'mildenhall', kind: 'idea', message: 'Could offices see a list of everything booked for today?', context: 'Office worker · screen: worker · PCS Path v15', attachment_path: null, attachment_name: null, status: 'resolved', reply: 'Thank you for the suggestion. Confirmed appointments are now listed under Appts, with the current day indicated.', replied_at: ts(1), created_at: ts(3) }
    ];
    db.role_requests = [
      { id: 'rr-1', user_id: 'u-webb', name: 'SSgt Webb, Sarah', base_id: 'mildenhall', current_roles: 'Member, Office worker', wanted_role: 'lead', reason: 'Current lead is PCSing soon and I am taking over the office.', status: 'pending', created_at: ts(2) },
      { id: 'rr-2', user_id: 'u-green', name: 'MSgt Green, Tara', base_id: 'yokota', current_roles: 'Member', wanted_role: 'mpf', reason: 'Yokota is onboarding next quarter and I run the MPF.', status: 'pending', created_at: ts(4) }
    ];
    return db;
  }

  var SPONSOR_PREP = [
    ['Complete eSAT sponsor training', 'Required for first-time sponsors and those not trained in the past year. Available on Military OneSource.'],
    ['Make initial contact within three duty days', 'Introduce yourself, confirm the arrival date and ask about family members, pets and vehicles.'],
    ['Send local area and base information', 'Include the newcomer guide, housing office contacts and school information if dependents are travelling.'],
    ['Confirm temporary lodging', 'Verify a reservation for the arrival date and the expected length of stay.'],
    ['Arrange transportation on arrival', 'Confirm flight details and transportation from the port of entry.'],
    ['Coordinate with the gaining supervisor', 'Confirm the reporting date, duty location and first-week schedule.']
  ];
  window.PCS_SEED = { sponsorPrep: SPONSOR_PREP, outKeys: OUT.map(function (t) { return t.k; }), build: build, starter: starter, demoAccounts: DEMO_ACCOUNTS, globalTips: GLOBAL_TIPS };
})();
