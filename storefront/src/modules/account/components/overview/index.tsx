
import { clx, Container, Divider } from "@medusajs/ui"
import s from "./style.module.scss"

import ChevronDown from "@modules/common/icons/chevron-down"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import BgImage from "../BgImage"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
}

const Overview = ({ customer, orders }: OverviewProps) => {
  const { percentage, incompleteSteps } = getProfileCompletion(customer)
  return (
    <main className={s.root} data-testid="overview-page">
      <div data-testid="overview-page-wrapper" className={s.content}>
        <div className={s.contentVisibleOnSmall}>
          <div className={s.headerRow}>
            <div className={s.headerWelcome}>
              <p data-testid="welcome-message" data-value={customer?.first_name} className={s.welcomeMessage}>
                Dobrý den, {" "}
                  <span>
                  {customer?.first_name}
                  </span>
              </p>
              <span className={s.headerSignedIn}>
                Přihlášen jako:{" "}
                <span className={s.fontSemibold} data-testid="customer-email" data-value={customer?.email}>
                  {customer?.email}
                </span>
              </span>
            </div>
            <Divider />
          </div>
          <div className={s.section}>
            <div className={s.cardsWrap}>
              <div className={s.profileRow}>
                <div className={s.groupCol}>
                  <h3 className={s.titleLarge}>Profil</h3>
                  <Divider />
                  <div className={s.statRow}>
                    <span
                      className={s.statValueLarge}
                      data-testid="customer-profile-completion"
                      data-value={percentage}
                    >
                      {percentage}%
                    </span>
                    <span className={s.subtleUpper}>
                      Dokončeno
                    </span>
                  </div>
                  <div className={s.progressBar}>
                    <div 
                      className={s.progressFill} 
                      style={{ width: `${percentage}%`, minWidth: percentage > 0 ? '2px' : '0px' }}
                      data-percentage={percentage}
                    ></div>
                  </div>
                  {incompleteSteps.length > 0 && (
                    <ul className={s.stepsList}>
                      {incompleteSteps.map(step => {
                        const getStepLink = (key: string) => {
                          switch (key) {
                            case 'email':
                            case 'name':
                            case 'phone':
                              return '/account/profile'
                            case 'billing':
                              return '/account/addresses'
                            default:
                              return '/account/profile'
                          }
                        }

                        const getStepButtonText = (key: string) => {
                          switch (key) {
                            case 'email':
                              return 'Přidat'
                            case 'name':
                              return 'Přidat'
                            case 'phone':
                              return 'Přidat'
                            case 'billing':
                              return 'Přidat'
                            default:
                              return 'Přidat'
                          }
                        }

                        return (
                          <li key={step.key} className={s.stepItem}>
                            <span className={s.stepBullet}>•</span>
                            <span className={s.stepText}>{step.label}</span>
                            <ScrollLink
                              href={getStepLink(step.key)}
                              text={getStepButtonText(step.key)}
                              className={s.stepButton}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className={s.groupCol}>
                  <h3 className={s.titleLarge}>Adresy</h3>
                  <div className={s.statRow}>
                    <span
                      className={s.statValueLarge}
                      data-testid="addresses-count"
                      data-value={customer?.addresses?.length || 0}
                    >
                      {customer?.addresses?.length || 0}
                    </span>
                    <span className={s.subtleUpper}>
                      Uloženo
                    </span>
                  </div>
                  <div className={s.LinkButtonS}>
                    <ScrollLink
                      href={`/account/addresses`}
                      text={`Přidat adresu`}
                      className={s.stepButton}
                    />
                  </div>
                </div>
              </div>

              <div className={s.ordersGroup}>
                <div className={s.ordersHeadingRow}>
                  <h3 className={s.titleLarge}>Nedávné objednávky</h3>
                </div>
                <Divider />
                <ul className={s.ordersList} data-testid="orders-wrapper">
                  {orders && orders.length > 0 ? (
                    orders.slice(0, 5).map((order) => {
                      return (
                        <li
                          key={order.id}
                          data-testid="order-wrapper"
                          data-value={order.id}
                        >
                          <LocalizedClientLink
                            href={`/account/orders/details/${order.id}`}
                          >
                            <Container className={s.orderCard}>
                              <div className={s.orderGrid}>
                                <span className={s.fontSemibold}>Datum objednání</span>
                                <span className={s.fontSemibold}>
                                  Číslo objednávky
                                </span>
                                <span className={s.fontSemibold}>
                                  Celková částka
                                </span>
                                <span data-testid="order-created-date">
                                  {new Date(order.created_at).toLocaleString('cs-CZ', {
                                    day: 'numeric',
                                    month: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}
                                </span>
                                <span
                                  data-testid="order-id"
                                  data-value={order.display_id}
                                >
                                  #{order.display_id}
                                </span>
                                <span data-testid="order-amount">
                                  {convertToLocale({
                                    amount: order.total,
                                    currency_code: order.currency_code,
                                  })}
                                </span>
                              </div>
                              <button className={s.orderOpenBtn} data-testid="open-order-button">
                                <span className="sr-only">
                                  Přejít na objednávku #{order.display_id}
                                </span>
                                <ChevronDown className={s.rotateNeg90} />
                              </button>
                            </Container>
                          </LocalizedClientLink>
                        </li>
                      )
                    })
                  ) : (
                    <span data-testid="no-orders-message">Žádné nedávné objednávky</span>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BgImage src="/assets/img/img/2.jpg" />
    </main>
  )
}

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  if (!customer) {
    return { percentage: 0, incompleteSteps: [] }
  }

  let count = 0
  const steps = [
    { 
      key: 'email', 
      label: 'Přidat e-mail', 
      completed: !!(customer.email && customer.email.trim() !== '') 
    },
    { 
      key: 'name', 
      label: 'Přidat jméno a příjmení', 
      completed: !!(customer.first_name && customer.first_name.trim() !== '' && customer.last_name && customer.last_name.trim() !== '') 
    },
    { 
      key: 'phone', 
      label: 'Přidat telefonní číslo', 
      completed: !!(customer.phone && customer.phone.trim() !== '') 
    },
    { 
      key: 'billing', 
      label: 'Přidat fakturační adresu', 
      completed: !!(customer.addresses && customer.addresses.length > 0 && customer.addresses.find(addr => addr.is_default_billing)) 
    },
  ]

  steps.forEach(step => {
    if (step.completed) count++
  })

  const percentage = Math.round((count / steps.length) * 100)
  const incompleteSteps = steps.filter(step => !step.completed)

  return { percentage, incompleteSteps }
}

export default Overview



function ScrollLink({
  href,
  text,
  className,
  textColor,
  borderColor,
  borderR = false,
  borderL = false,
  "data-testid": dataTestId,
}: {
  href: string;
  text: string;
  className?: string;
  textColor?: string;
  borderColor?: string;
  borderR?: boolean;
  borderL?: boolean;
  "data-testid"?: string;
}) {
  return (
    <LocalizedClientLink href={href} className={clx(s.ScrollLink, className)} data-testid={dataTestId}
      style={{
      }}
    >
        <button 
          className={s.button}
            style={{
            textDecoration: "none",
          }}
        >
            <div className={s.slider}>
                <div className={s.el}>
                    <PerspectiveText2 label={text} className={className} textColor={textColor}/>
                </div>
                <div className={s.el}>
                    <PerspectiveText2 label={text} className={className} textColor={textColor}/>
                </div>
            </div>
        </button>
    </LocalizedClientLink>
  );
}

function PerspectiveText2({label, className, textColor}: {label: string; className?: string; textColor?: string}) {
  return (    
      <div className={s.perspectiveText}>
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



