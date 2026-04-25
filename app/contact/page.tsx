export default function ContactRoute() {
  return (
    <main className="contact-main">
      <section className="contact-section">
        <div className="contact-wrap">
          <div className="contact-head">
            <span className="contact-badge">Contact</span>
            <h1>Liên hệ với John Thanh Lịch</h1>
            <p>
              Nếu muốn hợp tác, trao đổi công việc hoặc kết nối, có thể liên hệ
              qua các thông tin bên dưới.
            </p>
          </div>

          <div className="contact-grid">
            <div className="contact-card">
              <h2>Thông tin liên hệ</h2>

              <div className="contact-item">
                <span className="label">Tên</span>
                <p>John Nguyễn Thanh Lịch</p>
              </div>

              <div className="contact-item">
                <span className="label">Email</span>
                <p>
                  <a href="mailto:johnthanhlich01@gmail.com">
                    johnthanhlich01@gmail.com
                  </a>
                </p>
              </div>

              <div className="contact-item">
                <span className="label">Số điện thoại</span>
                <p>
                  <a href="tel:+61403340269">+61 403 340 269</a>
                  <small>(Úc)</small>
                </p>
              </div>

              <div className="contact-item">
                <span className="label">Địa chỉ</span>
                <p>Easthills 2213, Sydney NSW, Australia</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
