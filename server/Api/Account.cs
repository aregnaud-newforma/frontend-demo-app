namespace Api;

/// <summary>
/// The account as it goes over the wire, minus the id: every field the client
/// may send on a PUT. The same shape as <c>AccountPayload</c> in
/// src/account/helpers/api.ts, and the server never validates it - the form's
/// Zod schema is what rejects an unknown <c>Langue</c> or a bad email.
/// </summary>
/// <param name="Telephone">E.164, or null when the user cleared it.</param>
public record AccountPayload(
    string Nom,
    string Prenom,
    string Email,
    string? Telephone,
    string Langue,
    string Bio);

/// <summary>
/// The account as the server stores and returns it. Derives from the payload
/// rather than repeating it, so anything that takes a payload takes an account
/// too, and the JSON is the payload's fields plus <c>id</c>. One constructor
/// only: System.Text.Json binds a PUT body through it, and refuses a type
/// that gives it two to choose from.
/// </summary>
public sealed record Account(
    string Id,
    string Nom,
    string Prenom,
    string Email,
    string? Telephone,
    string Langue,
    string Bio) : AccountPayload(Nom, Prenom, Email, Telephone, Langue, Bio);

/// <summary>
/// One row of <c>accounts</c>: an account keyed by the session that owns it.
/// One account per session, so the session id is the primary key rather than a
/// foreign key on a separate table - it is the same key that isolates parallel
/// E2E specs (see Program.cs, PER-TEST ISOLATION). Mutable because EF Core
/// tracks changes by mutating the entity it loaded; the records above are what
/// leave this class.
/// </summary>
public sealed class AccountRow
{
    public required string Session { get; init; }
    public required string Id { get; set; }
    public required string Nom { get; set; }
    public required string Prenom { get; set; }
    public required string Email { get; set; }
    public string? Telephone { get; set; }
    public required string Langue { get; set; }
    public required string Bio { get; set; }

    public Account ToAccount() => new(Id, Nom, Prenom, Email, Telephone, Langue, Bio);

    /// <summary>Replaces every field the client may send; the id stays.</summary>
    public void Apply(AccountPayload payload)
    {
        Nom = payload.Nom;
        Prenom = payload.Prenom;
        Email = payload.Email;
        Telephone = payload.Telephone;
        Langue = payload.Langue;
        Bio = payload.Bio;
    }
}
