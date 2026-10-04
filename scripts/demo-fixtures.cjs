const PROJECT_ID='parcari-admin-demo-20261004';
function makeFixtures(now=new Date()) {
  const {Timestamp}=require('firebase-admin/firestore');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const base=new Date(today+'T12:00:00Z');
  const day=(n)=>new Date(base.getTime()+n*86400000).toISOString().slice(0,10);
  const names=['Andrei Ionescu','Maria Popescu','Elena Dumitrescu','Mihai Stan','Ioana Radu','Alexandru Marin','Ana Pavel','Cristian Dobre','Raluca Matei','Vlad Petrescu'];
  const models=['Dacia Logan','Renault Clio','Toyota Corolla','Volkswagen Golf','Ford Focus','Skoda Octavia','Hyundai Tucson','Kia Ceed','BMW Seria 3','Opel Astra'];
  const rows=[];
  for(let i=0;i<100;i++) {
    let start,end,inside=false,departed=false,source='webhook',status='confirmed_paid';
    if(i<45){start=-5-i*4;end=start+2;departed=true;}
    else if(i<60){start=-3;end=3;inside=true;}
    else if(i<70){start=0;end=4;inside=i<65;}
    else if(i<80){start=-4;end=0;inside=i<75;departed=!inside;}
    else if(i<84){start=-5;end=-1;inside=true;source='pay_on_site';status='confirmed_pay_on_site';}
    else if(i<90){start=2+i%5;end=start+3;}
    else if(i<94){start=3;end=6;status='cancelled_by_admin';}
    else if(i<98){start=1;end=4;status='api_error';}
    else {start=-10;end=-7;status='expired';departed=true;}
    const days=end-start, amount=days*35;
    const time=i>=65&&i<70?'16:00':i>=70&&i<80?'18:00':'09:00';
    const arrived=Timestamp.fromDate(new Date(day(start)+'T06:30:00Z'));
    const created=Timestamp.fromDate(new Date(day(Math.min(start-2,0))+'T09:00:00Z'));
    const data={demoSeed:true,demoSeedVersion:1,licensePlate:`B${String(100+i).padStart(3,'0')}TST`,clientName:names[i%names.length],clientEmail:`client${i+1}@example.com`,clientPhone:`TEST-${String(i+1).padStart(4,'0')}`,carMake:models[i%models.length].split(' ')[0],carModel:models[i%models.length],startDate:day(start),startTime:time,endDate:day(end),endTime:time,days,durationMinutes:days*1440,multiparkDurationMinutes:days*1440,amount,numberOfPersons:1+i%4,status,source,paymentStatus:source==='pay_on_site'?'pending':'paid',apiBookingNumber:`${700000+i}`,apiSuccess:status!=='api_error',apiMessage:'Mediu de test — API simulat',apiErrorCode:status==='api_error'?'0':'1',termsAccepted:true,createdAt:created,lastUpdated:Timestamp.fromDate(now),lpr:{isInside:inside,lastEventType:inside?'entry':departed?'exit':'none'},occupancyIncremented:inside};
    if(inside||departed)data.lpr.arrivedAt=arrived;
    if(departed)data.lpr.departedAt=Timestamp.fromDate(new Date(day(end)+'T07:00:00Z'));
    if(inside)data.lpr.lastSeenAt=arrived;
    if(i===60){data.cancellationRequested=true;data.cancellationReason='Cerere fictivă de anulare';}
    rows.push({collection:'bookings',id:`demo-booking-${String(i+1).padStart(3,'0')}`,data});
  }
  const booking=rows[85];
  const finalValues={startDate:booking.data.startDate,startTime:'10:00',endDate:booking.data.endDate,endTime:'10:00',licensePlate:booking.data.licensePlate};
  const request={id:'demo-modification-001',status:'pending_admin_review',currentAmount:booking.data.amount,newAmount:booking.data.amount,amountToPay:0,creditAmount:0,difference:0,paymentPolicy:'no_difference',finalValues};
  booking.data.modificationRequested=true;booking.data.activeModificationRequestId=request.id;booking.data.activeModificationRequest=request;
  rows.push({collection:'bookingModificationRequests',id:request.id,data:{...request,bookingId:booking.id,currentSnapshot:booking.data,userId:'demo-client',demoSeed:true,createdAt:Timestamp.fromDate(now),updatedAt:Timestamp.fromDate(now)}});
  for(let i=1;i<=30;i++) rows.push({collection:'prices',id:`demo-price-${i}`,data:{days:i,standardPrice:i*35,discountedPrice:i*28,reducereAplicata:i*7,discountPercentage:20,demoSeed:true}});
  for(let i=1;i<=4;i++)rows.push({collection:'lpr_whitelist',id:`B${900+i}TST`,data:{plate:`B${900+i}TST`,demoSeed:true,createdAt:Timestamp.fromDate(now)}});
  return {today,rows};
}
module.exports={PROJECT_ID,makeFixtures};
