import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import {
  getSupabasePublicConfig,
  isSupabaseClientConfigured,
  supabase
} from "../services/supabaseClient";
import { getDefaultRouteForUser } from "../utils/access";
import { saveSession } from "../utils/authStorage";

export default function Login() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredStat, setHoveredStat] = useState(null);
  const [ripples, setRipples] = useState([]);
  const rippleCounter = useRef(0);
  const canvasRef = useRef(null);
  const mouseEffectRef = useRef({ x: -9999, y: -9999, boost: 0 });
  const blob1Ref = useRef(null);
  const blob2Ref = useRef(null);
  const blob3Ref = useRef(null);
  const blob4Ref = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    document.body.classList.add("login-theme");

    return () => {
      document.body.classList.remove("login-theme");
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    const particles = [];
    const pointerLinks = [];

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    function seedParticles() {
      particles.length = 0;
      const total = Math.min(180, Math.max(92, Math.floor(window.innerWidth / 11)));

      for (let index = 0; index < total; index += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          radius: Math.random() * 1.9 + 0.45,
          alpha: Math.random() * 0.55 + 0.14,
          hue: index % 3,
        });
      }
    }

    function drawConnections() {
      for (let first = 0; first < particles.length; first += 1) {
        for (let second = first + 1; second < particles.length; second += 1) {
          const a = particles[first];
          const b = particles[second];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 156) continue;

          context.strokeStyle =
            a.hue === 0
              ? `rgba(0, 230, 180, ${0.1 * (1 - distance / 156)})`
              : `rgba(30, 160, 255, ${0.08 * (1 - distance / 156)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    }

    function drawPointerLinks(mouse) {
      pointerLinks.length = 0;

      particles.forEach((particle) => {
        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 190) {
          pointerLinks.push({ particle, distance });
        }
      });

      pointerLinks
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 18)
        .forEach(({ particle, distance }) => {
          context.strokeStyle = `rgba(13, 216, 255, ${0.16 * (1 - distance / 190)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(mouse.x, mouse.y);
          context.lineTo(particle.x, particle.y);
          context.stroke();
        });
    }

    function render() {
      context.clearRect(0, 0, width, height);
      const mouse = mouseEffectRef.current;
      mouse.boost = Math.max(0, mouse.boost - 0.014);

      particles.forEach((particle) => {
        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const proximity = distance < 260 ? 1 - distance / 260 : 0;
        const speedBoost = 1 + proximity * mouse.boost * 2.8;
        const pull = proximity * mouse.boost * 0.015;

        particle.vx += dx > 0 ? pull : -pull;
        particle.vy += dy > 0 ? pull : -pull;
        particle.vx = Math.max(-0.65, Math.min(0.65, particle.vx));
        particle.vy = Math.max(-0.65, Math.min(0.65, particle.vy));

        particle.x += particle.vx * speedBoost;
        particle.y += particle.vy * speedBoost;

        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;

        context.beginPath();
        context.fillStyle =
          particle.hue === 0
            ? `rgba(0, 230, 180, ${particle.alpha})`
            : particle.hue === 1
              ? `rgba(13, 216, 255, ${particle.alpha})`
              : `rgba(30, 160, 255, ${particle.alpha})`;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });

      drawConnections();
      if (mouse.x > -1000 && mouse.y > -1000) {
        drawPointerLinks(mouse);
      }
      animationFrame = window.requestAnimationFrame(render);
    }

    resize();
    seedParticles();
    render();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    function onMouseMove(event) {
      mouseEffectRef.current.x = event.clientX;
      mouseEffectRef.current.y = event.clientY;
      mouseEffectRef.current.boost = 1;

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const dx = (event.clientX - centerX) / centerX;
      const dy = (event.clientY - centerY) / centerY;

      if (blob1Ref.current) {
        blob1Ref.current.style.transform = `translate(${dx * 30}px, ${dy * 24}px)`;
      }

      if (blob2Ref.current) {
        blob2Ref.current.style.transform = `translate(${dx * -22}px, ${dy * -18}px)`;
      }

      if (blob3Ref.current) {
        blob3Ref.current.style.transform = `translate(calc(-50% + ${dx * 16}px), calc(-50% + ${dy * -12}px))`;
      }

      if (blob4Ref.current) {
        blob4Ref.current.style.transform = `translate(${dx * -12}px, ${dy * 20}px)`;
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  const features = [
    { icon: "ri-shield-check-line", label: "Avaliação conforme ISO 9001:2015" },
    { icon: "ri-bar-chart-2-line", label: "Dashboards e KPIs em tempo real" },
    { icon: "ri-file-list-3-line", label: "Relatórios automáticos de conformidade" },
    { icon: "ri-team-line", label: "Gestão completa de fornecedores" },
  ];

  const stats = [
    { value: "500+", label: "Fornecedores" },
    { value: "99.9%", label: "Uptime" },
    { value: "ISO", label: "Certificado" },
  ];

  const securityBadges = [
    { icon: "ri-shield-check-line", label: "SSL" },
    { icon: "ri-lock-line", label: "2FA" },
    { icon: "ri-eye-off-line", label: "LGPD" },
  ];

  function addRipple(event) {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const id = rippleCounter.current + 1;
    rippleCounter.current = id;

    setRipples((current) => [
      ...current,
      {
        id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      },
    ]);

    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== id));
    }, 700);
  }

  function getSupabasePayload() {
    const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig();

    return {
      supabaseUrl,
      supabaseAnonKey
    };
  }

  async function authenticateWithSupabase(email, password) {
    if (!isSupabaseClientConfigured() || !supabase) {
      return null;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const message = String(error.message || "").toLowerCase();
      const errorCode = String(error?.code || error?.name || "");

      if (message.includes("invalid path") || errorCode === "PGRST105") {
        const configError = new Error("supabase_url_invalid");
        configError.response = { status: 503 };
        throw configError;
      }

      if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
        const invalidError = new Error("invalid_credentials");
        invalidError.response = { status: 401 };
        throw invalidError;
      }

      throw error;
    }

    if (!data?.session?.access_token) {
      const invalidError = new Error("invalid_credentials");
      invalidError.response = { status: 401 };
      throw invalidError;
    }

    return api.post("/auth/session", {
      accessToken: data.session.access_token,
      rememberMe,
      ...getSupabasePayload()
    });
  }

  async function authenticateWithApi(email, password) {
    return api.post("/auth/login", {
      email,
      password,
      rememberMe,
      ...getSupabasePayload()
    });
  }

  async function login(event) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const normalizedEmail = form.email.trim().toLowerCase();
    const passwordCandidates = [...new Set([form.password, form.password.trim()].filter(Boolean))];

    try {
      let successfulResponse = null;
      let lastError = null;

      for (const password of passwordCandidates) {
        try {
          successfulResponse = await authenticateWithSupabase(normalizedEmail, password);

          if (!successfulResponse) {
            successfulResponse = await authenticateWithApi(normalizedEmail, password);
          }

          break;
        } catch (error) {
          lastError = error;

          if (error?.response?.status === 401) {
            continue;
          }

          throw error;
        }
      }

      if (!successfulResponse) {
        throw lastError || new Error("invalid_credentials");
      }

      const { data } = successfulResponse;

      saveSession({
        user: data?.user || null,
        token: data?.token || null,
        rememberMe,
      });
      nav(getDefaultRouteForUser(data?.user), { replace: true });
    } catch (error) {
      const status = error?.response?.status;
      const isInvalidCredentials =
        status === 401 || error?.message === "invalid_credentials";
      const isSupabaseConfigError = error?.message === "supabase_url_invalid";

      setError(
        isInvalidCredentials
          ? "Email ou senha invalidos"
          : isSupabaseConfigError
          ? "Configuracao do Supabase incorreta na Vercel. Use a URL base sem /rest/v1."
          : "Nao foi possivel entrar agora. Tente novamente em instantes."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="login-page"
      style={{
        background:
          "linear-gradient(135deg, #010810 0%, #020e1e 35%, #030f22 65%, #010810 100%)",
      }}
    >
      <canvas ref={canvasRef} className="login-particles-canvas" />
      <div className="login-bg-grid" />
      <div ref={blob1Ref} className="login-bg-radial login-bg-radial-a" />
      <div ref={blob2Ref} className="login-bg-radial login-bg-radial-b" />
      <div ref={blob3Ref} className="login-bg-radial login-bg-radial-c" />
      <div ref={blob4Ref} className="login-bg-radial login-bg-radial-d" />

      <div className="login-corner login-corner-top-left">
        <div className="login-corner-line login-corner-line-h" />
        <div className="login-corner-line login-corner-line-v" />
        <div className="login-corner-line login-corner-line-h login-corner-line-inner-h" />
        <div className="login-corner-line login-corner-line-v login-corner-line-inner-v" />
      </div>

      <div className="login-corner login-corner-top-right">
        <div className="login-corner-line login-corner-line-h" />
        <div className="login-corner-line login-corner-line-v" />
        <div className="login-corner-line login-corner-line-h login-corner-line-inner-h" />
        <div className="login-corner-line login-corner-line-v login-corner-line-inner-v" />
      </div>

      <div className="login-corner login-corner-bottom-left">
        <div className="login-corner-line login-corner-line-h" />
        <div className="login-corner-line login-corner-line-v" />
        <div className="login-corner-line login-corner-line-h login-corner-line-inner-h" />
        <div className="login-corner-line login-corner-line-v login-corner-line-inner-v" />
      </div>

      <div className="login-corner login-corner-bottom-right">
        <div className="login-corner-line login-corner-line-h" />
        <div className="login-corner-line login-corner-line-v" />
        <div className="login-corner-line login-corner-line-h login-corner-line-inner-h" />
        <div className="login-corner-line login-corner-line-v login-corner-line-inner-v" />
      </div>

      <div className="login-side-line login-side-line-left" />
      <div className="login-side-line login-side-line-right" />
      <div className="login-edge-line login-edge-line-top" />
      <div className="login-edge-line login-edge-line-bottom" />

      <div className="login-shell-exact">
        <section className="login-hero-exact anim-fade-slide-right">
          <div className="login-brand-exact">
            <img
              src="https://public.readdy.ai/ai/img_res/2a8a687b-b6e7-4f46-80b4-0d3e7b6c5610.png"
              alt="Conformix"
              className="login-brand-image-exact"
            />
          </div>

          <h1 className="login-title-exact">
            <span className="login-title-gradient">
              Gestão Inteligente
              <br />
              de Fornecedores
            </span>
          </h1>

          <p className="login-description-exact">
            Plataforma avançada para avaliação, monitoramento e conformidade de
            fornecedores conforme as normas ISO 9001:2015.
          </p>

          <div className="login-features-exact">
            {features.map((item, index) => (
              <div
                key={item.label}
                className="login-feature-row anim-fade-slide-right"
                style={{
                  animationDelay: `${0.3 + index * 0.1}s`,
                  animationFillMode: "both",
                }}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div
                  className="login-feature-icon"
                  style={{
                    background:
                      hoveredFeature === index
                        ? "linear-gradient(135deg, rgba(0,230,180,0.22) 0%, rgba(30,160,255,0.18) 100%)"
                        : "rgba(0,180,140,0.08)",
                    border:
                      hoveredFeature === index
                        ? "1px solid rgba(0,230,180,0.65)"
                        : "1px solid rgba(30,160,255,0.25)",
                    boxShadow:
                      hoveredFeature === index
                        ? "0 0 16px rgba(0,230,180,0.25)"
                        : "none",
                    transform:
                      hoveredFeature === index ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  <i
                    className={item.icon}
                    style={{
                      color: hoveredFeature === index ? "#00e6b4" : "#1ea0ff",
                      transform:
                        hoveredFeature === index ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                </div>
                <span
                  className="login-feature-label"
                  style={{
                    color: hoveredFeature === index ? "#ffffff" : "#9acce0",
                    transform:
                      hoveredFeature === index
                        ? "translateX(4px)"
                        : "translateX(0)",
                  }}
                >
                  {item.label}
                </span>
                {hoveredFeature === index ? (
                  <div className="login-feature-dot" />
                ) : null}
              </div>
            ))}
          </div>

          <div
            className="login-stats-exact anim-fade-slide-right"
            style={{ animationDelay: "0.75s", animationFillMode: "both" }}
          >
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="login-stat-exact anim-count-up"
                style={{
                  animationDelay: `${0.85 + index * 0.12}s`,
                  animationFillMode: "both",
                }}
                onMouseEnter={() => setHoveredStat(index)}
                onMouseLeave={() => setHoveredStat(null)}
              >
                <div
                  className="login-stat-value"
                  style={{
                    color: hoveredStat === index ? "#00e6b4" : "#24b8ff",
                    transform: hoveredStat === index ? "scale(1.08)" : "scale(1)",
                    filter:
                      hoveredStat === index
                        ? "drop-shadow(0 0 10px rgba(0,230,180,0.45))"
                        : "drop-shadow(0 0 8px rgba(30,160,255,0.18))",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="login-stat-label"
                  style={{ color: hoveredStat === index ? "#00e6b4" : "#7ac8e0" }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

        </section>

        <section
          className="login-form-wrap-exact anim-fade-slide-up"
          style={{ animationDelay: "0.15s", animationFillMode: "both" }}
        >
          <div className="login-card-exact">
            <div className="login-card-top-glow" />

            <div className="login-card-body-exact">
              <div className="login-mobile-brand-exact">
                <img
                  src="https://public.readdy.ai/ai/img_res/2a8a687b-b6e7-4f46-80b4-0d3e7b6c5610.png"
                  alt="Conformix"
                  className="login-brand-image-mobile-exact"
                />
              </div>

              <div className="login-form-header-exact">
                <div className="login-form-secure-exact">
                  <div className="login-form-secure-icon-exact">
                    <i className="ri-lock-2-line" />
                  </div>
                  <span>ACESSO SEGURO</span>
                </div>

                <h2>Bem-vindo de volta</h2>
                <p>Faça login para acessar o sistema</p>
              </div>

              <form onSubmit={login}>
                <div className="login-field-group-exact">
                  <label>E-MAIL / USUARIO</label>
                  <div
                    className="login-input-shell-exact"
                    style={{
                      border: emailFocused
                        ? "1px solid rgba(0,230,180,0.65)"
                        : "1px solid rgba(20,60,100,0.9)",
                      background: emailFocused
                        ? "rgba(0,230,180,0.04)"
                        : "rgba(5,18,40,0.95)",
                      boxShadow: emailFocused
                        ? "0 0 16px rgba(0,230,180,0.15)"
                        : "none",
                    }}
                  >
                    <div className="login-input-icon-exact">
                      <i
                        className="ri-user-3-line"
                        style={{
                          color: emailFocused ? "#00e6b4" : "#2a6080",
                        }}
                      />
                    </div>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          email: e.target.value,
                        }))
                      }
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      className="login-input-exact"
                      style={{ caretColor: "#00e6b4" }}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="login-field-group-exact">
                  <label>SENHA</label>
                  <div
                    className="login-input-shell-exact"
                    style={{
                      border: passwordFocused
                        ? "1px solid rgba(30,160,255,0.65)"
                        : "1px solid rgba(20,60,100,0.9)",
                      background: passwordFocused
                        ? "rgba(30,160,255,0.04)"
                        : "rgba(5,18,40,0.95)",
                      boxShadow: passwordFocused
                        ? "0 0 16px rgba(30,160,255,0.15)"
                        : "none",
                    }}
                  >
                    <div className="login-input-icon-exact">
                      <i
                        className="ri-key-2-line"
                        style={{
                          color: passwordFocused ? "#1ea0ff" : "#2a6080",
                        }}
                      />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••"
                      value={form.password}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          password: e.target.value,
                        }))
                      }
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className="login-input-exact login-input-password-exact"
                      style={{ caretColor: "#1ea0ff" }}
                      autoComplete={rememberMe ? "current-password" : "off"}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="login-password-toggle"
                      style={{ color: showPassword ? "#1ea0ff" : "#2a6080" }}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <i
                        className={
                          showPassword
                            ? "ri-eye-line text-base"
                            : "ri-eye-off-line text-base"
                        }
                      />
                    </button>
                  </div>
                </div>

                <div className="login-row-exact">
                  <label
                    className="login-remember-exact"
                    onClick={() => setRememberMe((current) => !current)}
                  >
                    <div
                      className="login-remember-box-exact"
                      style={{
                        border: rememberMe
                          ? "1px solid #00e6b4"
                          : "1px solid rgba(30,100,140,0.8)",
                        background: rememberMe
                          ? "linear-gradient(135deg, #00e6b4, #1ea0ff)"
                          : "transparent",
                      }}
                    >
                      {rememberMe ? (
                        <i className="ri-check-line login-remember-check-exact" />
                      ) : null}
                    </div>
                    <span>Lembrar-me</span>
                  </label>

                  <button type="button" className="login-link-button-exact">
                    Esqueceu a senha?
                  </button>
                </div>

                {error ? <div className="login-error">{error}</div> : null}

                <div className="login-submit-wrap-exact">
                  <div className="login-submit-glow-exact" />
                  <button
                    type="submit"
                    className="login-submit-exact shimmer-btn-blue"
                    onClick={addRipple}
                    disabled={isLoading}
                  >
                    {ripples.map((ripple) => (
                      <span
                        key={ripple.id}
                        className="login-ripple-exact"
                        style={{ left: ripple.x, top: ripple.y }}
                      />
                    ))}
                    <span className="login-submit-content-exact">
                      {isLoading ? (
                        <>
                          <i className="ri-loader-4-line animate-spin" />
                          VERIFICANDO...
                        </>
                      ) : (
                        <>
                          ENTRAR NO SISTEMA
                          <i className="ri-arrow-right-line" />
                        </>
                      )}
                    </span>
                  </button>
                </div>

                <div className="login-divider-exact">
                  <div className="login-divider-line-exact" />
                  <span>•••</span>
                  <div className="login-divider-line-exact" />
                </div>

                <div className="login-request-exact">
                  <span>Não tem acesso? </span>
                  <button type="button" className="login-request-link-exact">
                    Solicitar Cadastro
                    <i className="ri-external-link-line" />
                  </button>
                </div>

                <div className="login-badges-exact">
                  {securityBadges.map((item) => (
                    <div key={item.label} className="login-badge-item-exact">
                      <i className={item.icon} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </form>
            </div>
            <div className="login-card-bottom-glow-exact" />
          </div>
        </section>
      </div>
    </div>
  );
}
