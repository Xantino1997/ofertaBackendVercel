const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
   
  

const sendEmail = async (to, subject, text, html) => {
  try {
    await transporter.sendMail({
      from: `"Offerton" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text,
    });
    console.log(`✅ Email enviado a ${to}`);
  } catch (err) {
    console.error('❌ Error enviando email:', err);
    throw err;
  }
};


module.exports = sendEmail;
