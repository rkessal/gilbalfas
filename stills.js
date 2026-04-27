gsap.registerPlugin(SplitText)

const breakpoints = {
  tablet: 1024,
  mobile: 768
}

function createEventBus() {
  const e = {}
  return {
    on(t, fn) { (e[t] ??= []).push(fn) },
    emit(t, d) { (e[t] || []).forEach(fn => fn(d)) }
  }
}

function createMachine(initial, states, bus) {
  let current = initial

  function send(event, payload) {
    const def = states[current]
    const next = def?.on?.[event]
    if (!next) return current

    const leave = states[current]?.leave
    if (leave) leave()

    const enter = states[next]?.enter
    current = next
    if (enter) enter(payload)

    bus.emit("state", current)
    return current
  }

  return { send, get state() { return current } }
}

function waitForImages(container) {
  let rafImageId = null
  const images = Array.from(container.children)
  if (!container.dataset.cloned) {
    console.log("Cloning images for accurate measurements...")
    images.forEach(img => {
      container.appendChild(img.cloneNode(true))
    })
    container.dataset.cloned = "true"
  }

  const check = () => {
    if (container.scrollHeight > 0) {
      galleryInstance = setupGallery(container)
      cancelAnimationFrame(rafImageId)
      return
    }
    rafImageId = requestAnimationFrame(check)
  }

  check()
}

const debounce = (fn, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

let galleryInstance = null

window.addEventListener('load', async () => {
  const container = document.querySelector('.elementor-gallery__container')
  waitForImages(container)
})

window.addEventListener('resize', debounce(() => {
  if (galleryInstance) galleryInstance.destroy()
  const container = document.querySelector('.elementor-gallery__container')
  waitForImages(container)
}, 200))

function setupGallery(track) {
  const isMobile = window.innerWidth <= breakpoints.mobile

  const axis = isMobile ? "x" : "y"
  const sizeProp = axis === "x" ? "width" : "height"
  const posProp = axis === "x" ? "left" : "top"
  const clientProp = axis === "x" ? "clientX" : "clientY"
  const viewportSize = axis === "x"
    ? window.innerWidth
    : document.querySelector('.stills-gallery').offsetHeight

  const items = Array.from(track.children)
  const first = items[0]
  const second = items[1]

  const mainImageContainer = document.querySelector('.stills-main-image')

  const firstRect = first.getBoundingClientRect()
  const secondRect = second.getBoundingClientRect()

  const itemSize = secondRect[posProp] - firstRect[posProp]
  const maxScroll = (itemSize * items.length) / 2

  let currentY = 0
  let targetY = 0
  let velocity = 0

  let touchStartY = 0
  let touchCurrentY = 0
  let isTouching = false

  const inputStrength = 0.07
  const damping = 0.92
  const ease = 0.08

  const bus = createEventBus()

  const machine = createMachine("idle", {
    idle: {
      on: { SCROLL: "scrolling" }
    },
    scrolling: {
      enter() { },
      on: { STOP: "snapping" }
    },
    snapping: {
      enter() {
        targetY = getNearestSnap(targetY)
      },
      on: { DONE: "idle" }
    }
  }, bus)

  items.forEach(item => {
    item.onclick = () => snapToItem(item)
  })

  function snapToItem(item) {
    machine.send("SCROLL")
    const rect = item.getBoundingClientRect()

    const itemCenter = rect[posProp] + rect[sizeProp] / 2
    const screenCenter = viewportSize / 2

    const delta = itemCenter - screenCenter

    targetY += delta
  }

  function highlightActiveItem(item) {
    gsap.to(item, { filter: 'grayscale(0%)', duration: 0.3 })
  }

  function resetActiveItems(closest) {
    let filteredItems = items
    if (closest) {
      filteredItems = items.filter(i => i !== closest)
    }
    gsap.to(items, { filter: 'grayscale(100%)', duration: 0.3 })
  }

  function updateActiveItem() {
    let closest = null
    let closestDistance = Infinity

    items.forEach(item => {
      const rect = item.getBoundingClientRect()
      const itemCenter = rect[posProp] + rect[sizeProp] / 2

      const distance = Math.abs(itemCenter - viewportSize / 2)

      if (distance < closestDistance) {
        closestDistance = distance
        closest = item
      }
    })

    if (closest) {
      highlightActiveItem(closest)
      onUpdateActiveItem(closest)
    }
  }

  function onUpdateActiveItem(item) {
    const mainDescription = document.querySelector('.stills-description-text')
    const childDescription = mainDescription.firstElementChild
    const newDescription = item.querySelector('.elementor-gallery-item__content').textContent

    const mainImage = mainImageContainer.querySelector('img')
    const mainImageParent = mainImage.parentElement
    const newSrc = item.querySelector('.e-gallery-image')
      .style
      .backgroundImage
      .match(/url\(["']?([^"']*)["']?\)/)[1]

    if (mainImage.src !== newSrc) {
      const newImage = new Image()
      newImage.src = newSrc

      gsap.set(mainImage, { clipPath: 'inset(0% 0% 0% 0%)' })
      gsap.set(newImage, { scale: 1.05 })

      newImage.onload = () => {
        gsap.to(childDescription, { autoAlpha: 0 })
        gsap.to(mainImageParent, {
          opacity: 0,
          clipPath: 'inset(50% 0% 50% 0%)',
          ease: 'power4.in',
          duration: 1,
          onComplete: () => {
            gsap.to(childDescription, { autoAlpha: 1 })

            mainImage.remove()
            mainImageParent.appendChild(newImage)

            gsap.fromTo(mainImageParent, {
              opacity: 0,
              clipPath: 'inset(50% 0% 50% 0%)',
            }, {
              opacity: 1,
              clipPath: 'inset(0% 0% 0% 0%)',
              ease: 'power4.inOut',
              duration: 2,
            })

            gsap.to(newImage, {
              scale: 1,
              ease: 'power4.inOut',
              duration: 2.5,
            })

            childDescription.innerHTML = `<p>${newDescription} hello test</p>`
            testText(childDescription)
          }
        })
      }
    }
  }

  function getNearestSnap(y) {
    const centerOffset = viewportSize / 2 - itemSize / 2
    return Math.round((y + centerOffset) / itemSize) * itemSize - centerOffset
  }

  function onScroll(e) {
    velocity += e.deltaY * inputStrength
    machine.send("SCROLL")
  }

  function onTouchStart(e) {
    if (window.innerWidth > breakpoints.tablet) return
    isTouching = true
    touchStartY = e.touches[0][clientProp]
    touchCurrentY = touchStartY
  }

  function onTouchMove(e) {
    if (!isTouching) return
    const current = e.touches[0][clientProp]
    const delta = touchCurrentY - current
    touchCurrentY = current
    velocity += delta * inputStrength * 1.2
    machine.send("SCROLL")
  }

  function onTouchEnd() {
    if (!isTouching) return
    isTouching = false
  }

  function testText(text) {
    SplitText.create(text, {
      type: "lines, words",
      mask: "lines",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          duration: 1,
          y: 100,
          autoAlpha: 0,
          stagger: 0.05
        });
      }
    })
  }

  document.addEventListener('wheel', onScroll)
  document.addEventListener("touchstart", onTouchStart, { passive: true })
  document.addEventListener("touchmove", onTouchMove, { passive: true })
  document.addEventListener("touchend", onTouchEnd, { passive: true })

  let last = performance.now()
  let rafId = null

  function animate(now) {
    const dt = (now - last) / 16.666
    last = now

    targetY += velocity * dt
    velocity *= Math.pow(damping, dt)

    currentY += (targetY - currentY) * (1 - Math.pow(1 - ease, dt))

    if (currentY >= maxScroll) {
      currentY -= maxScroll
      targetY -= maxScroll
    }

    if (currentY <= 0) {
      currentY += maxScroll
      targetY += maxScroll
    }

    gsap.set(track, { [axis]: -currentY })

    const isSlow = Math.abs(velocity) < 0.03
    const isAtTarget = Math.abs(targetY - currentY) < 0.8

    if (machine.state === "scrolling" && isSlow) {
      machine.send("STOP")
    }

    if (machine.state === "snapping" && isSlow && isAtTarget) {
      velocity = 0
      machine.send("DONE")
    }

    rafId = requestAnimationFrame(animate)
  }

  bus.on('state', state => {
    if (state === 'scrolling') {
      resetActiveItems()
    } else if (state === 'idle') {
      updateActiveItem()
    }
  })

  animate(performance.now())

  return {
    destroy() {
      gsap.set(track, { x: 0, y: 0 })

      document.onwheel = null

      cancelAnimationFrame(rafId)

      document.removeEventListener('wheel', onScroll)
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)

    }
  }
}