import type { ReactNode } from "react"

type ShipmentProps = {
    /* `ReactNode`, ne jen text: odstavec o vrácení nese odkaz na poučení. */
    shipping: { title: string; content: ReactNode }[]
}


const Shipment = ({ shipping }: ShipmentProps) => {
    return (
        <div className="shipment">
           {shipping.map((item, idx) => (
                <div key={idx} className="shipment__item">
                    <h4>{item.title}</h4>
                    <p>{item.content}</p>
                </div>
            ))}
        </div>
    )
}

export default Shipment 