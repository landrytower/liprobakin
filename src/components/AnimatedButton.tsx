import type { ReactNode } from "react";

type AnimatedButtonProps = {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  href?: string;
  ariaLabel?: string;
  icon?: "send" | "book";
};

export default function AnimatedButton({
  onClick,
  children,
  className = "",
  disabled = false,
  type = "button",
  href,
  ariaLabel,
  icon = "send",
}: AnimatedButtonProps) {
  const buttonContent = (
    <>
      <div className="svg-wrapper-1">
        <div className="svg-wrapper">
          {icon === "book" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
            >
              <path fill="none" d="M0 0h24v24H0z"></path>
              <path
                fill="currentColor"
                d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z"
              ></path>
            </svg>
          )}
        </div>
      </div>
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`animated-send-btn ${className}`}
        aria-label={ariaLabel}
      >
        {buttonContent}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`animated-send-btn ${className}`}
      aria-label={ariaLabel}
    >
      {buttonContent}
    </button>
  );
}
