import { copyText } from './copyText'

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('пишет через Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyText('1. e4')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('1. e4')
    vi.unstubAllGlobals()
  })

  it('без Clipboard API падает на execCommand', async () => {
    vi.stubGlobal('navigator', {})
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })

    await expect(copyText('1. e4')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('возвращает false, если не вышло ни там, ни там', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } })
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })

    await expect(copyText('x')).resolves.toBe(false)
    vi.unstubAllGlobals()
  })
})
