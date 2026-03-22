import { ChevronDown } from "@medusajs/icons";
import styles from "./scrollLink.module.scss"

export default function NavScrollLink({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={styles.ScrollLink}
    >
        <button 
          className={styles.button}
            style={{
            textDecoration: "none",
          }}
        >
            <div className={styles.slider}>
                <div className={styles.el}>
                    <PerspectiveText label={text} className={className}/>
                </div>
                <div className={styles.el}>
                    <PerspectiveText label={text} className={className}/>
                </div>
            </div>
        </button>
    </div>
  );
}

export function MobileNavScrollLink({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={styles.MobileScrollLink}
    >
        <button 
          className={styles.button}
            style={{
            textDecoration: "none",
          }}
        >
            <div className={styles.slider}>
                <div className={styles.el}>
                    <PerspectiveText label={text} className={className}/>
                </div>
                <div className={styles.el}>
                  <PerspectiveText label={text} className={className}/>
                </div>
            </div>
        </button>
    </div>
  );
}

function PerspectiveText({label, className, textColor}: {label: string; className?: string; textColor?: string}) {
  return (    
      <div className={styles.perspectiveText}>
          <div className={styles.textWrapper}>
              <ChevronDown className={styles.chevron} size={16} />
              <p 
                className={className}
                style={{
                  color: textColor || "var(--blackText)",
                }}
              >
                {label}
              </p>
          </div>
          <div className={styles.textWrapper}>
              <ChevronDown className={styles.chevron} size={16} />
              <p 
                className={className}
                style={{
                  color: textColor || "var(--blackText)",
                }}
              >
                {label}
              </p>
          </div>
      </div>
  )
}