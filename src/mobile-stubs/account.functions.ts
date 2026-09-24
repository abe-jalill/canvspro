/** Web server functions are unreachable inside the native bundle. */
export async function deleteMyAccount(): Promise<never> {
  throw new Error("Account deletion must be completed on canvaspro.app.");
}
