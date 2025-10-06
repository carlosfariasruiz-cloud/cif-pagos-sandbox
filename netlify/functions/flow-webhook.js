const crypto = require('crypto');

const FLOW_API_KEY = '312F5DCD-BEC9-4498-A45F-6E0540LE86CE';
const FLOW_SECRET = 'b8cdacf8c7603ce55ba820e2785d751cd9eb6c63';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyj7BU8AbBj3R87GATMQ-d0jKia_OU7H9fThgXr9-GLv8A8GygwNQ8eR3CapKjOg5tT/exec';

exports.handler = async (event) => {
  console.log('Webhook llamado');
  
  const token = event.queryStringParameters?.token;
  
  if (!token) {
    return { statusCode: 200, body: 'OK' };
  }
  
  console.log('Token recibido:', token);
  
  // Procesar en background sin esperar
  processPayment(token).catch(err => console.error('Error procesando:', err));
  
  // Responder OK inmediatamente
  return {
    statusCode: 200,
    body: 'OK'
  };
};

async function processPayment(token) {
  try {
    console.log('Consultando Flow...');
    
    // Calcular firma
    const signString = `apiKey${FLOW_API_KEY}token${token}`;
    const signature = crypto.createHmac('sha256', FLOW_SECRET).update(signString).digest('hex');
    
    console.log('Firma calculada:', signature);
    
    // Consultar Flow con fetch
    const flowParams = new URLSearchParams({
      apiKey: FLOW_API_KEY,
      token: token,
      s: signature
    });
    
    const flowResponse = await fetch('https://sandbox.flow.cl/api/payment/getStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: flowParams.toString()
    });
    
    console.log('Flow respondió:', flowResponse.status);
    
    const flowData = await flowResponse.json();
    console.log('Datos de Flow:', JSON.stringify(flowData));
    
    // Si está aprobado (status = 2), llamar Apps Script
    if (flowData.status === 2) {
      console.log('Pago aprobado, llamando Apps Script...');
      
      const appsScriptParams = new URLSearchParams({
        action: 'confirmarPagoFlowFromMake',
        token: token,
        flowOrder: flowData.flowOrder,
        commerceOrder: flowData.commerceOrder,
        amount: flowData.amount,
        status: flowData.status
      });
      
      const appsScriptResponse = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: appsScriptParams.toString()
      });
      
      const appsScriptResult = await appsScriptResponse.text();
      console.log('Apps Script respondió:', appsScriptResult);
    } else {
      console.log('Pago no aprobado, status:', flowData.status);
    }
    
  } catch (error) {
    console.error('Error en processPayment:', error.message);
    console.error('Stack:', error.stack);
  }
}