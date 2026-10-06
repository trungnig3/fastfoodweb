import nodemailer from 'nodemailer';

// Cấu hình gửi mail thông báo khiếu nại qua Gmail
export const complaintTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'vuductrung240305@gmail.com',
    pass: 'kfysxopqdwpfangr'
  }
});

export interface ComplaintEmailData {
  CustomerName?: string;
  Phone?: string;
  Rating?: number;
  Category?: string;
  Content: string;
}

export async function sendComplaintEmail(data: ComplaintEmailData): Promise<boolean> {
  const { CustomerName, Phone, Rating, Category, Content } = data;
  const ratingStars = '⭐'.repeat(Rating || 5);
  
  // Sử dụng Promise timeout tối đa 2.5s để đảm bảo không bao giờ làm treo luồng người dùng
  const emailPromise = complaintTransporter.sendMail({
    from: '"FastFood Express" <vuductrung240305@gmail.com>',
    to: 'vuductrung240305@gmail.com',
    subject: `[FastFood POS] Đánh Giá / Góp Ý Mới (${ratingStars}) từ: ${CustomerName || 'Khách hàng'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
        <div style="background: #e11d48; color: #ffffff; padding: 18px 24px;">
          <h2 style="margin: 0; font-size: 18px;">🔔 THÔNG BÁO ĐÁNH GIÁ & GÓP Ý MỚI</h2>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Hệ thống FastFood Express & Đặt Món Trực Tuyến</div>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p style="margin-top: 0;">Xin chào Quản trị viên, bạn vừa nhận được đánh giá mới từ khách hàng:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-weight: bold; width: 140px; color: #64748b;">Mức đánh giá:</td>
              <td style="padding: 10px 0; font-weight: bold; color: #f59e0b; font-size: 16px;">${ratingStars} (${Rating || 5}/5 sao)</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Chủ đề / Danh mục:</td>
              <td style="padding: 10px 0; font-weight: 600; color: #0284c7;">${Category || 'Chất lượng món ăn'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Họ và tên:</td>
              <td style="padding: 10px 0; font-weight: 600; color: #0f172a;">${CustomerName || 'Khách vãng lai'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Số điện thoại:</td>
              <td style="padding: 10px 0; font-weight: bold; color: #e11d48; font-size: 15px;">${Phone || 'Chưa cung cấp'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Thời gian gửi:</td>
              <td style="padding: 10px 0; color: #334155;">${new Date().toLocaleString('vi-VN')}</td>
            </tr>
          </table>
          <div style="background: #f8fafc; border-left: 4px solid #e11d48; padding: 16px; border-radius: 6px; margin-top: 14px;">
            <div style="font-weight: bold; color: #0f172a; margin-bottom: 6px; font-size: 14px;">Nội dung phản ánh / nhận xét:</div>
            <div style="white-space: pre-wrap; font-size: 14px; color: #334155; line-height: 1.5;">${Content || 'Không có nội dung'}</div>
          </div>
        </div>
      </div>
    `
  });

  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 2500);
  });

  try {
    const res = await Promise.race([emailPromise.then(() => true), timeoutPromise]);
    if (res) console.log('✅ Đã gửi email thông báo đánh giá thành công đến Admin');
    return res;
  } catch (err: any) {
    console.warn('⚠️ Gửi email thông báo đánh giá chạy nền:', err?.message || err);
    return false;
  }
}
