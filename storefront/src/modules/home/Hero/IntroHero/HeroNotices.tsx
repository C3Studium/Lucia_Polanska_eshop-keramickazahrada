"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import { noticeLabel, type Notice } from "@lib/util/notices"

/**
 * Pás oznámení pod herem: dovolená a novinka, dokola.
 *
 * Data jsou z BACKENDU (`/store/shop-status`, tedy obrazovka „Dovolená
 * a oznámení" v administraci), ne z CMS. Texty hera jsou redakční a mění se
 * jednou za rok; tohle je provozní stav dílny a patří tam, kde se zapíná.
 *
 * Jede v CSS, ne v JavaScriptu. Je to nekonečná smyčka, která běží po celou dobu,
 * co je stránka otevřená — kdyby ji táhl `requestAnimationFrame`, platil by za ni
 * každý snímek jeden callback na hlavním vlákně, a to na stránce, kde už o ten
 * čas soupeří shader v pozadí. `transform` na složeném řádku umí prohlížeč posunout
 * bez zásahu skriptu.
 *
 * Smyčka bez skoku: obsah je v DOMu **dvakrát** a animace posouvá o −50 %. V okamžik,
 * kdy první kopie odjede přesně celá, je druhá na jejím místě a hodnota se vrátí na
 * nulu — což je tentýž obraz, takže návrat není vidět. Druhá kopie je proto
 * `aria-hidden`: pro čtečku je to duplikát, ne druhá zpráva.
 *
 * Tlačítko vlevo stojí MIMO ten posuvný řádek. Musí být trefitelné, a cíl, který
 * ujíždí, se trefit nedá.
 */
export default function HeroNotices({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null

  /* Odkaz nese jen novinka, a jen když ho majitelka vyplnila. Když ho má víc
     oznámení, vezme se první — tlačítko je jedno a dvě adresy neunese. */
  const withLink = notices.find((n) => n.href)

  /*
   * Jedna funkce pro obě kopie.
   *
   * Kopie musí být znak po znaku stejné, jinak se posun o −50 % netrefí a
   * smyčka viditelně poskočí. Dvě samostatně psané větve markupu by to
   * podmínkou nedržely — rozešly by se při první úpravě, kterou někdo udělá
   * jen v té horní.
   */
  const line = (copy: "first" | "second") => (
    <span className="Hero__Intro__Updates__Line" aria-hidden={copy === "second"}>
      {notices.map((n, i) => (
        <span key={`${copy}-${n.kind}-${i}`} className="Hero__Intro__Updates__Item">
          <span className="Hero__Intro__Updates__Kind" data-kind={n.kind}>
            {noticeLabel(n.kind)}
          </span>
          {n.message}
          {/* Den návratu za vzkazem, odlišený sazbou. Administrace ho má jako
              nepovinný, takže většinou není. */}
          {n.date && (
            <span className="Hero__Intro__Updates__Date">Návrat {n.date}</span>
          )}
        </span>
      ))}
    </span>
  )

  return (
    <div className="Hero__Intro__Updates__Rail">
      {withLink?.href && (
        <WebButton
          Kind="Link"
          tone="dark"
          title="Zjistit více"
          href={withLink.href}
          className="Hero__Intro__Updates__Cta"
        />
      )}

      {/* Maska drží pás uvnitř své šířky; kdyby přetékal, rozšířil by stránku. */}
      <div className="Hero__Intro__Updates__Viewport">
        <div className="Hero__Intro__Updates__Track">
          {line("first")}
          {/* Druhá kopie: bez ní by po odjetí první zůstala mezera. */}
          {line("second")}
        </div>
      </div>
    </div>
  )
}
