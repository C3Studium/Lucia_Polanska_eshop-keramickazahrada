import type { ReactNode } from "react"

type ShipmentProps = {
    /* `ReactNode`, ne jen text: odstavec o vrácení nese odkaz na poučení.
       `edit*` jsou atributy překryvu Studia u textů z CMS; mimo náhled prázdné. */
    shipping: {
        title: string
        content: ReactNode
        editTitle?: Record<string, string | undefined>
        editContent?: Record<string, string | undefined>
    }[]
}


const Shipment = ({ shipping }: ShipmentProps) => {
    return (
        <div className="shipment">
           {shipping.map((item, idx) => (
                <div key={idx} className="shipment__item">
                    <h4 {...item.editTitle}>{item.title}</h4>
                    <p {...item.editContent}>{item.content}</p>
                </div>
            ))}
        </div>
    )
}

export default Shipment
