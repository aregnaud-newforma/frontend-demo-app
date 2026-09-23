using Microsoft.EntityFrameworkCore;

namespace Api;

/// <summary>
/// The queries, and nothing else: no connection, no HTTP. Each takes the
/// context as its first argument so the same code runs against the API's
/// Postgres and against the one the tests start (see ../Api.Tests/StoreTests.cs).
/// </summary>
public static class Store
{
    public static async Task<Account?> FindAccount(AccountsDb db, string session)
    {
        var row = await db.Accounts.AsNoTracking().SingleOrDefaultAsync(row => row.Session == session);
        return row?.ToAccount();
    }

    /// <summary>Stores the account for this session, replacing whatever was there.</summary>
    public static async Task<Account> SaveAccount(AccountsDb db, string session, Account account)
    {
        var row = await db.Accounts.FindAsync(session);
        if (row is null)
        {
            row = new AccountRow
            {
                Session = session,
                Id = account.Id,
                Nom = account.Nom,
                Prenom = account.Prenom,
                Email = account.Email,
                Telephone = account.Telephone,
                Langue = account.Langue,
                Bio = account.Bio,
            };
            db.Accounts.Add(row);
        }
        else
        {
            row.Id = account.Id;
            row.Apply(account);
        }
        await db.SaveChangesAsync();
        return row.ToAccount();
    }

    /// <summary>
    /// Replaces every field the client may send, and keeps the id: the server
    /// owns it, so it is not in the payload and cannot be overwritten by one.
    /// Null when the session has no account to update.
    /// </summary>
    public static async Task<Account?> UpdateAccount(AccountsDb db, string session, AccountPayload payload)
    {
        var row = await db.Accounts.FindAsync(session);
        if (row is null)
        {
            return null;
        }
        row.Apply(payload);
        await db.SaveChangesAsync();
        return row.ToAccount();
    }
}
