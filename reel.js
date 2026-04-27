window.addEventListener('load', onLoad)

function onLoad() {
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

    const enter = states[initial]?.enter
    if (enter) enter()

    return { send, get state() { return current } }
  }

  const bus = createEventBus()

  bus.on("page:animate", () => {
    const gallery = '.reel-gallery-container .elementor-widget-wrap'
    const text = '.reel-gallery-container h2'

    SplitText.create(text, {
      type: "lines, words",
      mask: "lines",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          delay: 0.5,
          duration: 1,
          y: 100,
          autoAlpha: 0,
          stagger: 0.08
        });
      }
    })

    gsap.set(gallery, {
      clipPath: 'inset(0%, 100%, 0%, 0%)',
    })
    gsap.fromTo(gallery, {
      // clipPath: 'inset(0%, 100%, 0%, 0%)',
      autoAlpha: 0,
    }, {
      clipPath: 'inset(0%, 100%, 0%, 100%)',
      ease: 'power4.inOut',
      duration: 2,
      autoAlpha: 1,
      stagger: 0.08
    })
  })

  bus.on("video:mount", id => {
    const iframe = getOrCreateIframe()

    console.log('mount', {
      iframe,
      gsap
    })

    gsap.set(iframe, {
      clipPath: "inset(0% 0% 0% 0%)",
    })

    gsap.to(iframe, {
      clipPath: 'inset(50% 0% 50% 0%)',
      duration: 1.5,
      ease: 'power4.inOut',
      autoAlpha: 0,
      onComplete: () => {
        iframe.src = ""
        iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`

        iframe.onload = () => {
          machine.send("READY", id)
        }
      }
    })
  })

  bus.on("video:play", id => {
    const iframe = container.querySelector("iframe")
    if (!iframe) return

    window.scrollTo({ top: 0 })

    gsap.fromTo(iframe, {
      clipPath: 'inset(50% 0% 50% 0%)',
    }, {
      autoAlpha: 1,
      clipPath: 'inset(0% 0% 0% 0%)',
      ease: 'power4.inOut',
      duration: 2,
    })
  })


  const machine = createMachine("idle", {
    idle: {
      enter() {
        bus.emit("page:animate")
        console.log('idle enter')
      },
      on: { PLAY: "loading" }
    },

    loading: {
      enter(id) {
        bus.emit("video:mount", id)
      },
      on: { READY: "playing" }
    },

    playing: {
      enter(id) {
        bus.emit("video:play", id)
      },
      on: { PLAY: "loading" }
    }

  }, bus)

  let container = document.querySelector(".reel-video-container .elementor-open-inline")

  function getOrCreateIframe() {
    const iframe = container.querySelector("iframe")
    return iframe
  }

  const videos = document.querySelectorAll(".reel-gallery-container .elementor-widget-video")

  videos.forEach(el => {
    const settings = JSON.parse(el.dataset.settings || "{}")
    el.addEventListener("click", () => {
      const id = settings.youtube_url?.split("v=")?.[1]?.split("&")?.[0]
      machine.send("PLAY", id)
    })
  })
}