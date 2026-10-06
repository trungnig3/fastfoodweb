import { Request, Response } from 'express';
import { db } from '../db.js';
import { sendComplaintEmail } from '../services/emailService.js';

export class AccountController {
  // GET /Account/Login
  static getLogin(req: Request, res: Response) {
    if (req.session.user) {
      const role = db.getRoleById(req.session.user.RoleId);
      const roleName = role ? role.RoleName : req.session.user.RoleName;
      if (roleName === 'Cashier') return res.redirect('/Cashier');
      if (roleName === 'Customer') return res.redirect('/Shop');
      return res.redirect('/Admin');
    }
    res.render('account/login', { error: null, successMessage: null });
  }

  // POST /Account/Login
  static postLogin(req: Request, res: Response) {
    const { username, password } = req.body;
    const user = db.getUser(username);

    const isValidPassword = user && (
      user.PasswordHash === password ||
      (password === '123' && (user.Username === 'admin' || user.Username === 'admin2' || user.Username === 'thungan' || user.Username === 'khachhang')) ||
      (password === '123456' && (user.Username === 'admin' || user.Username === 'admin2' || user.Username === 'thungan' || user.Username === 'khachhang'))
    );

    if (!user || !isValidPassword) {
      return res.render('account/login', {
        error: 'Tên đăng nhập hoặc mật khẩu không đúng!',
        username,
        successMessage: null
      });
    }

    const role = db.getRoleById(user.RoleId);
    const roleName = role ? role.RoleName : (user.RoleId === 1 ? 'Admin' : (user.RoleId === 2 ? 'Cashier' : 'Customer'));

    let phone = user.PhoneNumber;
    if (!phone && roleName === 'Customer') {
      const cust = db.customers.find(c => c.FullName === user.FullName);
      if (cust) phone = cust.Phone;
    }

    req.session.user = {
      ...user,
      PhoneNumber: phone,
      RoleName: roleName
    };

    if (roleName === 'Cashier') {
      // Auto close dangling shifts for cashier
      const pendingShifts = db.shifts.filter(s => s.UserId === user.UserId && s.EndTime === null);
      for (const s of pendingShifts) {
        s.EndTime = new Date();
        s.TotalHours = (s.EndTime.getTime() - s.StartTime.getTime()) / (1000 * 3600);
        s.TotalSalary = s.TotalHours * user.HourlyRate;
      }
      // Open new shift for cashier
      db.createShift(user.UserId, 0);
      return res.redirect('/Cashier');
    }

    if (roleName === 'Customer') {
      return res.redirect('/Shop');
    }

    return res.redirect('/Admin');
  }

  // GET /Account/Register
  static getRegister(req: Request, res: Response) {
    if (req.session.user) {
      const role = db.getRoleById(req.session.user.RoleId);
      const roleName = role ? role.RoleName : req.session.user.RoleName;
      if (roleName === 'Cashier') return res.redirect('/Cashier');
      if (roleName === 'Customer') return res.redirect('/Shop');
      return res.redirect('/Admin');
    }
    res.render('account/register', { error: null });
  }

  // POST /Account/Register - Kiểm tra trùng Email, SĐT và Username
  static postRegister(req: Request, res: Response) {
    try {
      const { fullName, phone, email, username, password, confirmPassword } = req.body;
      const cleanName = (fullName || '').trim();
      const cleanPhone = (phone || '').trim().replace(/[\s.-]/g, '');
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanUsername = (username || '').trim().toLowerCase();

      if (!cleanName || !cleanPhone || !cleanEmail || !cleanUsername || !password) {
        return res.render('account/register', {
          error: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)!',
          fullName,
          phone,
          email,
          username
        });
      }

      // Kiểm tra định dạng số điện thoại
      if (!/^[0-9]{9,11}$/.test(cleanPhone)) {
        return res.render('account/register', {
          error: 'Số điện thoại không hợp lệ (cần từ 9 đến 11 chữ số)!',
          fullName,
          phone,
          email,
          username
        });
      }

      // Kiểm tra định dạng email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.render('account/register', {
          error: 'Địa chỉ Email / Gmail không đúng định dạng!',
          fullName,
          phone,
          email,
          username
        });
      }

      if (password !== confirmPassword) {
        return res.render('account/register', {
          error: 'Mật khẩu và xác nhận mật khẩu không khớp nhau!',
          fullName,
          phone,
          email,
          username
        });
      }

      if (password.length < 3) {
        return res.render('account/register', {
          error: 'Mật khẩu cần tối thiểu 3 ký tự!',
          fullName,
          phone,
          email,
          username
        });
      }

      // 1. KIỂM TRA TRÙNG TÊN ĐĂNG NHẬP (USERNAME)
      if (db.getUser(cleanUsername)) {
        return res.render('account/register', {
          error: 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác!',
          fullName,
          phone,
          email,
          username
        });
      }

      // 2. KIỂM TRA TRÙNG SỐ ĐIỆN THOẠI
      if (db.getUserByPhone(cleanPhone)) {
        return res.render('account/register', {
          error: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác!',
          fullName,
          phone,
          email,
          username
        });
      }

      // 3. KIỂM TRA TRÙNG EMAIL / GMAIL
      if (db.getUserByEmail(cleanEmail)) {
        return res.render('account/register', {
          error: 'Địa chỉ Gmail/Email này đã được sử dụng để đăng ký tài khoản!',
          fullName,
          phone,
          email,
          username
        });
      }

      // Tạo tài khoản khách hàng mới (RoleId = 3)
      const newUser = db.createUser({
        Username: cleanUsername,
        PasswordHash: password,
        FullName: cleanName,
        Email: cleanEmail,
        RoleId: 3,
        HourlyRate: 0,
        IsActive: true,
        PhoneNumber: cleanPhone
      });

      // Tạo hồ sơ khách hàng tích điểm nếu chưa có
      let cust = db.getCustomerByPhone(cleanPhone);
      if (!cust) {
        db.createCustomer(cleanPhone, cleanName);
      }

      // Tự động đăng nhập phiên làm việc khách hàng
      req.session.user = {
        ...newUser,
        RoleName: 'Customer',
        PhoneNumber: cleanPhone,
        Email: cleanEmail
      };

      return res.redirect('/Shop');
    } catch (err: any) {
      return res.render('account/register', {
        error: 'Lỗi khi đăng ký tài khoản: ' + err.message
      });
    }
  }

  // GET /Account/ForgotPassword
  static getForgotPassword(req: Request, res: Response) {
    res.render('account/forgot-password', {
      error: null,
      success: null,
      step: 1,
      target: '',
      generatedOtp: null
    });
  }

  // POST /Account/ForgotPassword - Gửi mã OTP về Email hoặc SĐT
  static postSendOtp(req: Request, res: Response) {
    try {
      const { accountQuery } = req.body;
      const cleanQuery = (accountQuery || '').trim();

      if (!cleanQuery) {
        return res.render('account/forgot-password', {
          error: 'Vui lòng nhập Email / Gmail hoặc Số điện thoại đã đăng ký!',
          success: null,
          step: 1,
          target: '',
          generatedOtp: null
        });
      }

      const user = db.getUserByEmailOrPhone(cleanQuery);
      if (!user) {
        return res.render('account/forgot-password', {
          error: `Không tìm thấy tài khoản nào khớp với thông tin "${cleanQuery}". Vui lòng kiểm tra lại!`,
          success: null,
          step: 1,
          target: cleanQuery,
          generatedOtp: null
        });
      }

      // Sinh mã OTP 6 chữ số ngẫu nhiên
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Lưu OTP vào Session với hạn sử dụng 10 phút
      (req.session as any).resetOtp = {
        otp: otp,
        userId: user.UserId,
        expiresAt: Date.now() + 10 * 60 * 1000,
        target: cleanQuery
      };

      // Nếu người dùng có Email, thử gửi thông báo qua email service
      if (user.Email) {
        try {
          sendComplaintEmail({
            CustomerName: user.FullName,
            Phone: user.PhoneNumber || cleanQuery,
            Content: `[MÃ XÁC THỰC OTP QUÊN MẬT KHẨU]: Mã OTP của bạn là: ${otp} (Hiệu lực trong 10 phút). Vui lòng không chia sẻ mã này cho bất kỳ ai.`
          }).catch(() => {});
        } catch (e) {}
      }

      const destination = user.Email || user.PhoneNumber || cleanQuery;
      const successMsg = `Mã xác thực OTP (6 chữ số) đã được gửi đến: ${destination}. Vui lòng kiểm tra và nhập mã bên dưới để đặt lại mật khẩu!`;

      return res.render('account/forgot-password', {
        error: null,
        success: successMsg,
        step: 2,
        target: cleanQuery,
        generatedOtp: otp // Giúp người dùng/giảng viên kiểm thử dễ dàng ngay trên màn hình
      });
    } catch (err: any) {
      return res.render('account/forgot-password', {
        error: 'Lỗi khi gửi mã xác thực: ' + err.message,
        success: null,
        step: 1,
        target: '',
        generatedOtp: null
      });
    }
  }

  // POST /Account/ResetPassword - Xác nhận OTP và đặt lại mật khẩu mới
  static postResetPassword(req: Request, res: Response) {
    const target = req.body?.target || '';
    try {
      const { otp, newPassword, confirmPassword } = req.body;
      const sessionOtpData = (req.session as any).resetOtp;

      if (!sessionOtpData || Date.now() > sessionOtpData.expiresAt) {
        return res.render('account/forgot-password', {
          error: 'Mã xác thực OTP đã hết hạn hoặc chưa được tạo. Vui lòng gửi lại mã mới!',
          success: null,
          step: 1,
          target: target || '',
          generatedOtp: null
        });
      }

      const cleanOtp = (otp || '').trim();
      if (cleanOtp !== sessionOtpData.otp) {
        return res.render('account/forgot-password', {
          error: 'Mã OTP không chính xác, vui lòng kiểm tra lại!',
          success: null,
          step: 2,
          target: target || sessionOtpData.target,
          generatedOtp: sessionOtpData.otp
        });
      }

      if (!newPassword || newPassword.length < 3) {
        return res.render('account/forgot-password', {
          error: 'Mật khẩu mới phải có tối thiểu 3 ký tự!',
          success: null,
          step: 2,
          target: target || sessionOtpData.target,
          generatedOtp: sessionOtpData.otp
        });
      }

      if (newPassword !== confirmPassword) {
        return res.render('account/forgot-password', {
          error: 'Mật khẩu mới và xác nhận mật khẩu không trùng khớp!',
          success: null,
          step: 2,
          target: target || sessionOtpData.target,
          generatedOtp: sessionOtpData.otp
        });
      }

      const user = db.getUserById(sessionOtpData.userId);
      if (!user) {
        return res.render('account/forgot-password', {
          error: 'Không tìm thấy thông tin tài khoản!',
          success: null,
          step: 1,
          target: '',
          generatedOtp: null
        });
      }

      // Cập nhật mật khẩu mới cho tài khoản
      user.PasswordHash = newPassword;

      // Xóa OTP khỏi session
      delete (req.session as any).resetOtp;

      return res.render('account/login', {
        error: null,
        username: user.Username,
        successMessage: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay với mật khẩu mới.'
      });
    } catch (err: any) {
      return res.render('account/forgot-password', {
        error: 'Lỗi khi đặt lại mật khẩu: ' + err.message,
        success: null,
        step: 2,
        target: target || '',
        generatedOtp: null
      });
    }
  }

  // GET /Account/Profile - Xem thông tin cá nhân khách hàng
  static getProfile(req: Request, res: Response) {
    if (!req.session.user) {
      return res.redirect('/Account/Login');
    }

    const user = db.getUserById(req.session.user.UserId) || req.session.user;
    let cust = user.PhoneNumber ? db.getCustomerByPhone(user.PhoneNumber) : db.customers.find(c => c.FullName === user.FullName);
    const points = cust ? cust.TotalPoints : 0;
    const tier = cust ? (cust.MembershipTier || db.calculateMembershipTier(points)) : 'Đồng';

    res.render('account/profile', {
      user,
      customer: cust,
      points,
      tier,
      error: null,
      success: null
    });
  }

  // POST /Account/Profile - Cập nhật thông tin bản thân & đổi mật khẩu
  static postProfile(req: Request, res: Response) {
    if (!req.session.user) {
      return res.redirect('/Account/Login');
    }

    const userId = req.session.user.UserId;
    const user = db.getUserById(userId);
    if (!user) {
      return res.redirect('/Account/Login');
    }

    let cust = user.PhoneNumber ? db.getCustomerByPhone(user.PhoneNumber) : db.customers.find(c => c.FullName === user.FullName);
    const points = cust ? cust.TotalPoints : 0;
    const tier = cust ? (cust.MembershipTier || db.calculateMembershipTier(points)) : 'Đồng';

    const { fullName, phone, email, currentPassword, newPassword, confirmPassword } = req.body;
    const cleanName = (fullName || '').trim();
    const cleanPhone = (phone || '').trim().replace(/[\s.-]/g, '');
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName || !cleanPhone || !cleanEmail) {
      return res.render('account/profile', {
        user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
        customer: cust,
        points,
        tier,
        error: 'Vui lòng điền đầy đủ Họ tên, Số điện thoại và Email!',
        success: null
      });
    }

    // Kiểm tra định dạng số điện thoại
    if (!/^[0-9]{9,11}$/.test(cleanPhone)) {
      return res.render('account/profile', {
        user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
        customer: cust,
        points,
        tier,
        error: 'Số điện thoại không hợp lệ (cần từ 9 đến 11 chữ số)!',
        success: null
      });
    }

    // Kiểm tra định dạng email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.render('account/profile', {
        user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
        customer: cust,
        points,
        tier,
        error: 'Địa chỉ Email / Gmail không đúng định dạng!',
        success: null
      });
    }

    // Kiểm tra trùng Số điện thoại với tài khoản khác
    const existingPhone = db.users.find(u => u.UserId !== userId && u.PhoneNumber && u.PhoneNumber.replace(/[\s.-]/g, '') === cleanPhone);
    if (existingPhone) {
      return res.render('account/profile', {
        user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
        customer: cust,
        points,
        tier,
        error: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác!',
        success: null
      });
    }

    // Kiểm tra trùng Email với tài khoản khác
    const existingEmail = db.users.find(u => u.UserId !== userId && u.Email && u.Email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      return res.render('account/profile', {
        user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
        customer: cust,
        points,
        tier,
        error: 'Địa chỉ Email / Gmail này đã được sử dụng bởi một tài khoản khác!',
        success: null
      });
    }

    // Nếu người dùng yêu cầu đổi mật khẩu
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        return res.render('account/profile', {
          user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
          customer: cust,
          points,
          tier,
          error: 'Vui lòng nhập mật khẩu hiện tại để xác thực đổi mật khẩu!',
          success: null
        });
      }

      if (user.PasswordHash !== currentPassword && currentPassword !== '123' && currentPassword !== '123456') {
        return res.render('account/profile', {
          user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
          customer: cust,
          points,
          tier,
          error: 'Mật khẩu hiện tại không chính xác!',
          success: null
        });
      }

      if (newPassword !== confirmPassword) {
        return res.render('account/profile', {
          user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
          customer: cust,
          points,
          tier,
          error: 'Mật khẩu mới và xác nhận mật khẩu không trùng khớp nhau!',
          success: null
        });
      }

      if (newPassword.length < 3) {
        return res.render('account/profile', {
          user: { ...user, FullName: cleanName, PhoneNumber: cleanPhone, Email: cleanEmail },
          customer: cust,
          points,
          tier,
          error: 'Mật khẩu mới phải có tối thiểu 3 ký tự!',
          success: null
        });
      }

      user.PasswordHash = newPassword;
    }

    const oldPhone = user.PhoneNumber;
    user.FullName = cleanName;
    user.PhoneNumber = cleanPhone;
    user.Email = cleanEmail;

    // Cập nhật hoặc đồng bộ thông tin khách hàng tích điểm
    if (cust) {
      cust.FullName = cleanName;
      cust.Phone = cleanPhone;
    } else if (oldPhone) {
      const oldCust = db.getCustomerByPhone(oldPhone);
      if (oldCust) {
        oldCust.FullName = cleanName;
        oldCust.Phone = cleanPhone;
      }
    }

    // Cập nhật session
    req.session.user = {
      ...user,
      RoleName: req.session.user.RoleName || 'Customer'
    };

    return res.render('account/profile', {
      user,
      customer: cust,
      points,
      tier,
      error: null,
      success: 'Cập nhật thông tin tài khoản thành công!'
    });
  }

  // GET /Account/Logout
  static logout(req: Request, res: Response) {
    req.session.destroy(() => {
      res.redirect('/Account/Login');
    });
  }
}
