import Link from "next/link";
import LocalizedClientLink from "../../localized-client-link";

export default function ScrollLink({
  href,
  text,
  className,
  textColor,
  borderColor,
  borderR = false,
  borderL = false,
}: {
  href: string;
  text: string;
  className?: string;
  textColor?: string;
  borderColor?: string;
  borderR?: boolean;
  borderL?: boolean;
}) {
  return (
    <LocalizedClientLink href={`/${href}`} className="ScrollLink"
      style={{
        borderRight: borderR ? `1px solid ${borderColor}` : "var(--shadows)",  
        borderLeft: borderL ? `1px solid ${borderColor}` : "var(--shadows)",
      }}
    >
        <button 
          className="button"
            style={{
            textDecoration: "none",
          }}
        >
            <div className="slider">
                <div className="el">
                    <PerspectiveText label={text} className={className} textColor={textColor}/>
                </div>
                <div className="el">
                    <PerspectiveText label={text} className={className} textColor={textColor}/>
                </div>
            </div>
        </button>
    </LocalizedClientLink>
  );
}

function PerspectiveText({label, className, textColor}: {label: string; className?: string; textColor?: string}) {
  return (    
      <div className="perspectiveText">
          <p 
            className={className}
            style={{
              color: textColor || "var(--blackText)",
            }}
          >
            {label}
          </p>
          <p 
            className={className}
            style={{
              color: textColor || "var(--blackText)",
            }}
          >
            {label}
          </p>
      </div>
  )
}