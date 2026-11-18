import { mainFirst, movePhoto } from "../components/photo-strip-order"

describe("pořadí fotek", () => {
  it("přetažení dopředu i dozadu", () => {
    expect(movePhoto(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"])
    expect(movePhoto(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"])
  })

  it("na stejné místo nebo mimo rozsah nic nemění", () => {
    const list = ["a", "b"]
    expect(movePhoto(list, 1, 1)).toBe(list)
    expect(movePhoto(list, 5, 0)).toBe(list)
  })

  it("hlavní fotka jde na začátek", () => {
    expect(mainFirst(["116", "116b", "kvety", "91", "91b"], "91b")).toEqual([
      "91b",
      "116",
      "116b",
      "kvety",
      "91",
    ])
    expect(mainFirst(["a", "b"], "a")).toEqual(["a", "b"])
  })
})
